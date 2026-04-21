from __future__ import annotations

import re
import time
import uuid
import logging
from typing import Any, AsyncGenerator

from app.config import (
    LLMConfig,
    PipelineState,
    PipelineStep,
    UserInput,
)
from app.core.safety import run_syntax_check
from app.core.rag import format_rag_context
from app.core.simulator import get_simulator
from app.core.comparison import compare_outcome
from app.core.metrics import PipelineRunLog
from app.prompts.system import get_system_prompt
from app.prompts.templates import (
    build_simple_prompt,
    build_feasibility_prompt,
    build_labware_map_prompt,
    build_generation_prompt,
    build_fix_prompt,
)
from app.providers.base import BaseLLMProvider

logger = logging.getLogger(__name__)


def _extract_code(text: str) -> str:
    pattern = r"```(?:python)?\s*\n(.*?)```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()


async def run_simple_pipeline(
    provider: BaseLLMProvider,
    user_input: UserInput,
    llm_config: LLMConfig,
) -> str:
    rag_context = format_rag_context(user_input.goal)
    system_prompt = get_system_prompt("simple")
    prompt = build_simple_prompt(user_input.goal, user_input.context, rag_context)
    response = await provider.generate(prompt, system_prompt=system_prompt)
    return _extract_code(response.text)


async def run_developer_pipeline(
    provider: BaseLLMProvider,
    state: PipelineState,
) -> AsyncGenerator[PipelineState, None]:
    system_prompt = get_system_prompt("developer")
    rag_context = format_rag_context(state.user_input.goal)

    # Step 1: Feasibility
    state.step = PipelineStep.FEASIBILITY
    prompt = build_feasibility_prompt(state.user_input.goal, state.user_input.context)
    response = await provider.generate(prompt, system_prompt=system_prompt)
    state.feasibility = response.text
    yield state

    # Step 2: Labware map
    state.step = PipelineStep.LABWARE_MAP
    prompt = build_labware_map_prompt(state.user_input.goal, state.feasibility or "")
    response = await provider.generate(prompt, system_prompt=system_prompt)
    from app.config import LabwareMap
    state.labware_map = LabwareMap(raw_text=response.text)
    yield state

    # Step 3: Code generation
    state.step = PipelineStep.CODE_GENERATION
    prompt = build_generation_prompt(
        goal=state.user_input.goal,
        feasibility=state.feasibility or "",
        labware_map=state.labware_map.raw_text if state.labware_map else "",
        rag_context=rag_context,
    )
    response = await provider.generate(prompt, system_prompt=system_prompt)
    state.generated_code = _extract_code(response.text)
    yield state

    # Step 4: Syntax check
    state.step = PipelineStep.SYNTAX_CHECK
    report = run_syntax_check(state.generated_code or "")
    state.syntax_ok = report.passed
    state.syntax_errors = [iss.message for iss in report.issues]
    yield state

    # Step 5: Simulation
    state.step = PipelineStep.SIMULATION
    simulator = get_simulator("mock")
    state.simulation = simulator.simulate(state.generated_code or "", state.user_input.goal)
    yield state

    # Step 6: Outcome comparison
    state.step = PipelineStep.OUTCOME_COMPARISON
    if state.simulation:
        state.comparison = await compare_outcome(
            sim_result=state.simulation,
            goal=state.user_input.goal,
            code=state.generated_code or "",
            provider=provider,
        )
    yield state

    # Step 7: Results
    state.step = PipelineStep.RESULTS
    state.final_script = state.generated_code
    yield state


async def run_agentic_pipeline(
    provider: BaseLLMProvider,
    state: PipelineState,
) -> AsyncGenerator[dict[str, Any], None]:
    run_id = str(uuid.uuid4())[:8]
    start_time = time.time()
    run_log = PipelineRunLog(
        run_id=run_id,
        mode="agentic",
        provider=str(state.llm_config.provider),
        model=state.llm_config.model_name,
        goal=state.user_input.goal,
    )

    system_prompt = get_system_prompt("agentic")
    rag_context = format_rag_context(state.user_input.goal)
    max_retries = state.max_retries

    for attempt in range(max_retries + 1):
        state.retry_count = attempt
        yield {"event": "retry_start", "attempt": attempt, "max_retries": max_retries}

        # Feasibility
        state.step = PipelineStep.FEASIBILITY
        yield {"event": "step_start", "step": "feasibility"}
        prompt = build_feasibility_prompt(state.user_input.goal, state.user_input.context)
        response = await provider.generate(prompt, system_prompt=system_prompt)
        state.feasibility = response.text
        yield {"event": "step_complete", "step": "feasibility", "attempt": attempt}

        # Labware map
        state.step = PipelineStep.LABWARE_MAP
        prompt = build_labware_map_prompt(state.user_input.goal, state.feasibility or "")
        response = await provider.generate(prompt, system_prompt=system_prompt)
        from app.config import LabwareMap
        state.labware_map = LabwareMap(raw_text=response.text)
        yield {"event": "step_complete", "step": "labware_map", "attempt": attempt}

        # Code generation (or fix)
        if attempt == 0:
            state.step = PipelineStep.CODE_GENERATION
            prompt = build_generation_prompt(
                goal=state.user_input.goal,
                feasibility=state.feasibility or "",
                labware_map=state.labware_map.raw_text if state.labware_map else "",
                rag_context=rag_context,
            )
        else:
            state.step = PipelineStep.FIX
            prompt = build_fix_prompt(
                code=state.generated_code or "",
                errors=state.syntax_errors,
                warnings=state.simulation.warnings if state.simulation else [],
                comparison=state.comparison.explanation if state.comparison else "",
            )

        response = await provider.generate(prompt, system_prompt=system_prompt)
        state.generated_code = _extract_code(response.text)
        yield {"event": "step_complete", "step": state.step.value, "attempt": attempt}

        # Syntax check
        state.step = PipelineStep.SYNTAX_CHECK
        report = run_syntax_check(state.generated_code or "")
        state.syntax_ok = report.passed
        state.syntax_errors = [iss.message for iss in report.issues]
        run_log.syntax_errors += len([i for i in report.issues if i.severity == "error"])
        run_log.hallucinations += len([i for i in report.issues if i.severity == "warning"])
        yield {"event": "step_complete", "step": "syntax_check", "passed": report.passed, "attempt": attempt}

        if not report.passed:
            yield {"event": "syntax_failed", "errors": state.syntax_errors, "attempt": attempt}
            continue

        # Simulation
        state.step = PipelineStep.SIMULATION
        simulator = get_simulator("mock")
        state.simulation = simulator.simulate(state.generated_code or "", state.user_input.goal)
        yield {"event": "step_complete", "step": "simulation", "attempt": attempt}

        # Comparison
        state.step = PipelineStep.OUTCOME_COMPARISON
        state.comparison = await compare_outcome(
            sim_result=state.simulation,
            goal=state.user_input.goal,
            code=state.generated_code or "",
            provider=provider,
        )
        yield {
            "event": "step_complete",
            "step": "outcome_comparison",
            "match": state.comparison.match,
            "score": state.comparison.score,
            "attempt": attempt,
        }

        if state.comparison.match or state.comparison.score >= 0.8:
            state.final_script = state.generated_code
            run_log.final_success = True
            if attempt == 0:
                run_log.first_pass_success = True
            run_log.comparison_score = state.comparison.score
            break
    else:
        state.final_script = state.generated_code
        run_log.comparison_score = state.comparison.score if state.comparison else 0.0

    run_log.total_retries = state.retry_count
    run_log.duration_seconds = time.time() - start_time
    run_log.save()

    yield {
        "event": "pipeline_complete",
        "success": run_log.final_success,
        "retries": state.retry_count,
        "run_id": run_id,
        "state": state.model_dump(),
    }
