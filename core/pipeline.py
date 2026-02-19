"""Script generation pipeline per Updated PRD v2.

Simple Mode:  prompt → generate → return file
Developer Mode: prompt → feasibility → labware map → codegen → syntax → simulate → compare → results
Agentic Mode:  Developer pipeline + retry loop on failure
"""

import json
import re
from typing import Generator, Optional

from config import (
    Mode, PipelineStep, PipelineState, LLMConfig, UserInput,
    LabwareMap, SimulationResult, ComparisonResult,
)
from core.safety import run_syntax_check, SafetyReport
from core.simulator import get_simulator
from core.comparison import compare_outcome
from core.rag import retrieve, format_rag_context
from core.metrics import PipelineRunLog
from providers.base import BaseLLMProvider
from prompts.system import get_system_prompt
from prompts.templates import (
    build_simple_prompt,
    build_feasibility_prompt,
    build_labware_map_prompt,
    build_generation_prompt,
    build_fix_prompt,
)


def _extract_code(text: str) -> str:
    pattern = re.compile(r"```(?:python)?\s*\n(.*?)```", re.DOTALL)
    match = pattern.search(text)
    if match:
        return match.group(1).strip()
    return text.strip()


def _extract_json(text: str) -> Optional[dict]:
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


# ---------- Simple Mode ----------

def run_simple_pipeline(
    provider: BaseLLMProvider,
    user_input: UserInput,
    llm_config: LLMConfig,
) -> tuple[str, PipelineRunLog]:
    """Simple Mode: prompt in, file out."""
    rag_docs = retrieve(user_input.procedure)
    rag_context = format_rag_context(rag_docs)
    system_prompt = get_system_prompt(Mode.SIMPLE)

    prompt = build_simple_prompt(user_input.procedure, rag_context)
    response = provider.generate(
        system_prompt=system_prompt,
        user_prompt=prompt,
        temperature=llm_config.temperature,
        max_tokens=llm_config.max_tokens,
        image_path=user_input.image_path,
    )

    script = _extract_code(response.text)
    log = PipelineRunLog(
        mode="simple",
        model=llm_config.model_name,
        input_prompt=user_input.procedure,
        generated_code=script,
        final_passed=True,
    )
    log.save()
    return script, log


def run_simple_pipeline_stream(
    provider: BaseLLMProvider,
    user_input: UserInput,
    llm_config: LLMConfig,
) -> Generator[str, None, None]:
    """Simple Mode with streaming output."""
    rag_docs = retrieve(user_input.procedure)
    rag_context = format_rag_context(rag_docs)
    system_prompt = get_system_prompt(Mode.SIMPLE)
    prompt = build_simple_prompt(user_input.procedure, rag_context)

    yield from provider.generate_stream(
        system_prompt=system_prompt,
        user_prompt=prompt,
        temperature=llm_config.temperature,
        max_tokens=llm_config.max_tokens,
        image_path=user_input.image_path,
    )


# ---------- Developer Mode Pipeline ----------

def step_feasibility(
    provider: BaseLLMProvider,
    state: PipelineState,
) -> PipelineState:
    """Step 2: Feasibility check."""
    rag_docs = retrieve(state.user_input.procedure)
    rag_context = format_rag_context(rag_docs)
    system_prompt = get_system_prompt(Mode.DEVELOPER)
    prompt = build_feasibility_prompt(state.user_input.procedure, rag_context)

    response = provider.generate(
        system_prompt=system_prompt,
        user_prompt=prompt,
        temperature=0.1,
    )

    data = _extract_json(response.text)
    if data:
        state.feasibility_result = data.get("reasoning", response.text)
        state.feasibility_passed = data.get("feasible", False)
    else:
        state.feasibility_result = response.text
        state.feasibility_passed = "not feasible" not in response.text.lower()

    state.current_step = PipelineStep.FEASIBILITY
    return state


def step_labware_map(
    provider: BaseLLMProvider,
    state: PipelineState,
) -> PipelineState:
    """Step 3: Generate labware map for user review."""
    rag_docs = retrieve(state.user_input.procedure + " labware deck layout")
    rag_context = format_rag_context(rag_docs)
    system_prompt = get_system_prompt(Mode.DEVELOPER)

    prompt = build_labware_map_prompt(
        procedure=state.user_input.procedure,
        user_labware=state.user_input.labware_locations or "",
        rag_context=rag_context,
    )

    response = provider.generate(
        system_prompt=system_prompt,
        user_prompt=prompt,
        temperature=0.2,
    )

    data = _extract_json(response.text)
    if data:
        state.labware_map = LabwareMap(
            items=data.get("labware", []),
            deck_positions=data.get("deck_layout", {}),
            expected_outcome=data.get("expected_outcome", ""),
            raw_text=json.dumps(data, indent=2),
        )
    else:
        state.labware_map = LabwareMap(raw_text=response.text)

    if not state.labware_map.expected_outcome and state.user_input.expected_outcome:
        state.labware_map.expected_outcome = state.user_input.expected_outcome

    state.current_step = PipelineStep.LABWARE_MAP
    return state


def step_code_generation(
    provider: BaseLLMProvider,
    state: PipelineState,
    error_context: str = "",
) -> PipelineState:
    """Step 4: Generate PyHamilton script."""
    rag_docs = retrieve(state.user_input.procedure)
    rag_context = format_rag_context(rag_docs)
    system_prompt = get_system_prompt(state.llm_config.provider and Mode.DEVELOPER or Mode.DEVELOPER)

    labware_text = state.labware_map.raw_text if state.labware_map else ""
    expected = state.labware_map.expected_outcome if state.labware_map else ""

    if error_context:
        prompt = build_fix_prompt(
            script=state.generated_script or "",
            errors=error_context.split("\n") if isinstance(error_context, str) else error_context,
            error_context=error_context,
            rag_context=rag_context,
        )
    else:
        prompt = build_generation_prompt(
            procedure=state.user_input.procedure,
            labware_map_text=labware_text,
            expected_outcome=expected,
            rag_context=rag_context,
        )

    response = provider.generate(
        system_prompt=system_prompt,
        user_prompt=prompt,
        temperature=state.llm_config.temperature,
        max_tokens=state.llm_config.max_tokens,
        image_path=state.user_input.image_path if not error_context else None,
    )

    state.generated_script = _extract_code(response.text)
    state.current_step = PipelineStep.CODE_GENERATION
    return state


def step_syntax_check(state: PipelineState) -> PipelineState:
    """Step 5: Syntax check via Python parser."""
    report = run_syntax_check(state.generated_script or "")
    state.syntax_passed = report.passed
    state.syntax_errors = [i.message for i in report.issues]
    state.current_step = PipelineStep.SYNTAX_CHECK
    return state


def step_simulation(state: PipelineState) -> PipelineState:
    """Step 6: Run script in simulator."""
    simulator = get_simulator()
    result = simulator.run(state.generated_script or "")
    state.simulation = result
    state.current_step = PipelineStep.SIMULATION
    return state


def step_outcome_comparison(
    provider: BaseLLMProvider,
    state: PipelineState,
) -> PipelineState:
    """Step 7: Compare simulation results against expected outcome."""
    expected = ""
    if state.labware_map:
        expected = state.labware_map.expected_outcome
    if state.user_input.expected_outcome:
        expected = state.user_input.expected_outcome

    if not state.simulation or not state.simulation.success:
        state.comparison = ComparisonResult(
            match=False,
            report="Simulation failed — cannot compare outcomes.",
        )
    else:
        state.comparison = compare_outcome(provider, state.simulation, expected)

    state.current_step = PipelineStep.OUTCOME_COMPARISON
    return state


def run_developer_pipeline(
    provider: BaseLLMProvider,
    state: PipelineState,
) -> Generator[PipelineState, None, None]:
    """Run the full Developer Mode pipeline, yielding state after each step.

    The UI can interrupt between steps (e.g. for labware map review).
    """
    # Step 2: Feasibility
    state = step_feasibility(provider, state)
    yield state
    if not state.feasibility_passed:
        return

    # Step 3: Labware Map (user reviews before continuing)
    state = step_labware_map(provider, state)
    yield state

    # Step 4: Code Generation
    state = step_code_generation(provider, state)
    yield state

    # Step 5: Syntax Check
    state = step_syntax_check(state)
    yield state
    if not state.syntax_passed:
        state.error_history.append({
            "step": "syntax_check",
            "errors": state.syntax_errors,
        })
        return

    # Step 6: Simulation
    state = step_simulation(state)
    yield state
    if not state.simulation or not state.simulation.success:
        state.error_history.append({
            "step": "simulation",
            "error": state.simulation.error if state.simulation else "No simulation result",
        })
        return

    # Step 7: Outcome Comparison
    state = step_outcome_comparison(provider, state)
    yield state

    # Step 8: Results
    state.final_passed = (
        state.syntax_passed
        and state.simulation is not None
        and state.simulation.success
        and (state.comparison is None or state.comparison.match)
    )
    state.current_step = PipelineStep.RESULTS
    yield state


def run_agentic_pipeline(
    provider: BaseLLMProvider,
    state: PipelineState,
) -> Generator[dict, None, None]:
    """Agentic Mode: run Developer pipeline with retry loop.

    Yields events for real-time UI display:
    - {"type": "step", "step": str, "state": PipelineState}
    - {"type": "retry", "attempt": int, "error": str, "diagnosis": str}
    - {"type": "done", "success": bool, "state": PipelineState}
    """
    run_log = PipelineRunLog(
        mode="agentic",
        model=state.llm_config.model_name,
        input_prompt=state.user_input.procedure,
    )

    for attempt in range(state.max_retries + 1):
        error_context = ""

        if attempt > 0:
            last_error = state.error_history[-1] if state.error_history else {}
            error_context = json.dumps(last_error, indent=2)

            rag_docs = retrieve(f"PyHamilton error fix: {json.dumps(last_error)}")
            rag_context = format_rag_context(rag_docs)

            diagnosis = _diagnose_error(provider, state, last_error, rag_context)
            yield {
                "type": "retry",
                "attempt": attempt,
                "error": json.dumps(last_error),
                "diagnosis": diagnosis,
            }

            state = step_code_generation(provider, state, error_context=error_context)
            yield {"type": "step", "step": "code_generation", "state": state}

            state = step_syntax_check(state)
            yield {"type": "step", "step": "syntax_check", "state": state}

            if not state.syntax_passed:
                state.retry_count = attempt
                state.error_history.append({
                    "step": "syntax_check",
                    "errors": state.syntax_errors,
                    "attempt": attempt,
                })
                run_log.retry_history.append({"attempt": attempt, "failed_at": "syntax_check"})
                continue

            state = step_simulation(state)
            yield {"type": "step", "step": "simulation", "state": state}

            if not state.simulation or not state.simulation.success:
                state.retry_count = attempt
                state.error_history.append({
                    "step": "simulation",
                    "error": state.simulation.error if state.simulation else "No result",
                    "attempt": attempt,
                })
                run_log.retry_history.append({"attempt": attempt, "failed_at": "simulation"})
                continue

            state = step_outcome_comparison(provider, state)
            yield {"type": "step", "step": "outcome_comparison", "state": state}

        else:
            for step_state in run_developer_pipeline(provider, state):
                state = step_state
                yield {"type": "step", "step": state.current_step.value, "state": state}

        state.final_passed = (
            state.syntax_passed
            and state.simulation is not None
            and state.simulation.success
            and (state.comparison is None or state.comparison.match)
        )

        if state.final_passed:
            break

        if not state.final_passed and attempt < state.max_retries:
            if state.error_history:
                last = state.error_history[-1]
            elif not state.syntax_passed:
                state.error_history.append({"step": "syntax_check", "errors": state.syntax_errors})
            elif state.simulation and not state.simulation.success:
                state.error_history.append({"step": "simulation", "error": state.simulation.error})
            elif state.comparison and not state.comparison.match:
                state.error_history.append({"step": "outcome_comparison", "report": state.comparison.report})

    state.retry_count = attempt
    state.current_step = PipelineStep.RESULTS

    run_log.generated_code = state.generated_script
    run_log.syntax_check_passed = state.syntax_passed
    run_log.syntax_errors = state.syntax_errors
    run_log.simulation_passed = state.simulation.success if state.simulation else False
    run_log.simulation_logs = state.simulation.logs if state.simulation else ""
    run_log.final_passed = state.final_passed
    run_log.retry_count = state.retry_count
    run_log.error_category = _classify_error(state)
    run_log.save()

    yield {"type": "done", "success": state.final_passed, "state": state}


def _diagnose_error(
    provider: BaseLLMProvider,
    state: PipelineState,
    error: dict,
    rag_context: str = "",
) -> str:
    """Have the LLM diagnose the root cause of a pipeline failure."""
    prompt = f"""A PyHamilton script failed during the pipeline. Diagnose the root cause.

## Error Details
{json.dumps(error, indent=2)}

## Current Script
```python
{state.generated_script or "No script generated"}
```

{f"## Reference Documentation{chr(10)}{rag_context}" if rag_context else ""}

Provide a brief diagnosis (2-3 sentences) of what went wrong and what should be fixed."""

    try:
        response = provider.generate(
            system_prompt="You are a PyHamilton debugging expert.",
            user_prompt=prompt,
            temperature=0.1,
        )
        return response.text.strip()
    except Exception as e:
        return f"Diagnosis failed: {e}"


def _classify_error(state: PipelineState) -> str | None:
    """Classify the error category for metrics."""
    if not state.error_history:
        return None
    last = state.error_history[-1]
    step = last.get("step", "")
    if step == "syntax_check":
        return "syntax"
    elif step == "simulation":
        return "runtime"
    elif step == "outcome_comparison":
        return "logic"
    return "unknown"
