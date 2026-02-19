"""Agentic Mode UI — autonomous pipeline with retry loop and full visibility."""

import streamlit as st

from config import LLMConfig, UserInput, PipelineState, PipelineStep, PIPELINE_STEP_LABELS
from core.pipeline import run_agentic_pipeline
from core.metrics import load_aggregate_metrics
from providers.factory import create_provider
from ui.components import (
    render_pipeline_progress,
    render_badge,
    render_event,
    render_script_output,
    render_metrics_grid,
)


def render_agentic_mode(llm_config: LLMConfig):
    st.markdown(
        '<div class="card"><div class="card-header">Agentic Mode</div>'
        '<div style="color:var(--text-secondary);font-size:0.85rem;">'
        'Runs the full Developer pipeline autonomously. If any step fails, '
        'the agent diagnoses the error, fixes the script, and retries from the failed step.'
        '</div></div>',
        unsafe_allow_html=True,
    )

    procedure = st.text_area(
        "What do you want to automate?",
        height=140,
        placeholder="Cherry-pick specific wells from a source plate based on a hit list...",
        key="agent_procedure",
    )

    col_lab, col_exp = st.columns(2)
    with col_lab:
        labware_loc = st.text_area(
            "Labware & locations (optional)",
            height=80,
            placeholder="96-well plate at position 4, tip rack at position 1...",
            key="agent_labware",
        )
    with col_exp:
        expected = st.text_area(
            "Expected outcome (optional)",
            height=80,
            placeholder="All hit wells transferred to destination plate...",
            key="agent_expected",
        )

    max_retries = st.slider("Max retries", min_value=1, max_value=10, value=3, key="agent_retries")

    col_run, col_metrics = st.columns([1, 1])
    with col_run:
        run_btn = st.button("Run Agent", type="primary", use_container_width=True, key="agent_run")
    with col_metrics:
        show_metrics = st.button("Show Metrics Dashboard", use_container_width=True, key="agent_metrics")

    if show_metrics:
        _render_metrics_dashboard()

    if run_btn:
        if not llm_config.api_key:
            st.error("Enter your API key in the sidebar.")
            return
        if not procedure:
            st.warning("Describe what you want to automate.")
            return

        provider = create_provider(llm_config.provider, llm_config.api_key, llm_config.model_name)
        user_input = UserInput(
            procedure=procedure,
            labware_locations=labware_loc or None,
            expected_outcome=expected or None,
        )
        state = PipelineState(
            user_input=user_input,
            llm_config=llm_config,
            max_retries=max_retries,
        )

        st.markdown('<hr class="divider">', unsafe_allow_html=True)
        st.markdown('<div class="card-header">Agent Execution Log</div>', unsafe_allow_html=True)

        progress_placeholder = st.empty()
        event_container = st.container()
        failed_step = None

        try:
            for event in run_agentic_pipeline(provider, state):
                etype = event["type"]

                if etype == "step":
                    step_name = event["step"]
                    state = event["state"]
                    step_label = PIPELINE_STEP_LABELS.get(
                        PipelineStep(step_name) if step_name in [s.value for s in PipelineStep] else PipelineStep.INPUT,
                        step_name,
                    )

                    try:
                        current_step_enum = PipelineStep(step_name)
                    except ValueError:
                        current_step_enum = PipelineStep.INPUT

                    with progress_placeholder:
                        render_pipeline_progress(current_step_enum, failed_step)

                    with event_container:
                        status = _get_step_status(state, step_name)
                        render_event("step", f"Step: {step_label}", status)

                        if step_name == "syntax_check" and not state.syntax_passed:
                            failed_step = "syntax_check"
                            for err in state.syntax_errors:
                                render_event("error", "Syntax Error", err)

                        if step_name == "simulation" and state.simulation and not state.simulation.success:
                            failed_step = "simulation"
                            render_event("error", "Simulation Error", state.simulation.error or "")

                        if step_name == "code_generation" and state.generated_script:
                            with st.expander("View Generated Code"):
                                st.code(state.generated_script, language="python")

                elif etype == "retry":
                    failed_step = None
                    with event_container:
                        render_event(
                            "retry",
                            f"Retry {event['attempt']}/{max_retries}",
                            f"Diagnosis: {event.get('diagnosis', 'Analyzing error...')}",
                        )

                elif etype == "done":
                    state = event["state"]
                    with progress_placeholder:
                        render_pipeline_progress(PipelineStep.RESULTS, failed_step)

                    with event_container:
                        st.markdown('<hr class="divider">', unsafe_allow_html=True)
                        if event["success"]:
                            render_badge(f"Success (retries: {state.retry_count})", "pass")
                            if state.generated_script:
                                render_script_output(state.generated_script)
                        else:
                            render_badge(f"Failed after {state.retry_count} retries", "fail")
                            if state.generated_script:
                                with st.expander("Last attempted script"):
                                    st.code(state.generated_script, language="python")
                            if state.error_history:
                                with st.expander("Error history"):
                                    for i, err in enumerate(state.error_history):
                                        st.json(err)

                        render_metrics_grid({
                            "Retries": str(state.retry_count),
                            "Syntax": "Pass" if state.syntax_passed else "Fail",
                            "Simulation": "Pass" if (state.simulation and state.simulation.success) else "Fail",
                            "Outcome": "Match" if (state.comparison and state.comparison.match) else "—",
                        })

        except Exception as e:
            st.error(f"Agent error: {e}")


def _get_step_status(state: PipelineState, step_name: str) -> str:
    if step_name == "feasibility":
        return "Feasible" if state.feasibility_passed else f"Not feasible: {state.feasibility_result}"
    elif step_name == "labware_map":
        return f"{len(state.labware_map.items)} items" if state.labware_map and state.labware_map.items else "Generated"
    elif step_name == "code_generation":
        lines = len(state.generated_script.splitlines()) if state.generated_script else 0
        return f"Generated ({lines} lines)"
    elif step_name == "syntax_check":
        return "Passed" if state.syntax_passed else f"Failed: {len(state.syntax_errors)} error(s)"
    elif step_name == "simulation":
        if state.simulation:
            return "Passed" if state.simulation.success else f"Failed: {state.simulation.error}"
        return "Pending"
    elif step_name == "outcome_comparison":
        if state.comparison:
            return f"{'Match' if state.comparison.match else 'Mismatch'} ({state.comparison.tier_used})"
        return "Pending"
    return ""


def _render_metrics_dashboard():
    st.markdown('<hr class="divider">', unsafe_allow_html=True)
    st.markdown('<div class="card-header">Metrics Dashboard</div>', unsafe_allow_html=True)

    metrics = load_aggregate_metrics()
    display = metrics.to_display()
    render_metrics_grid(display)

    if metrics.error_categories:
        st.markdown('<div class="card-header" style="margin-top:1rem;">Error Categories</div>', unsafe_allow_html=True)
        render_metrics_grid(metrics.error_categories)
