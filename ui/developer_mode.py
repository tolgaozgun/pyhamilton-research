"""Developer Mode UI — 8-step validated pipeline with review checkpoints."""

import json
import streamlit as st

from config import LLMConfig, UserInput, PipelineState, PipelineStep
from core.pipeline import run_developer_pipeline
from core.metrics import PipelineRunLog
from providers.factory import create_provider
from ui.components import (
    render_pipeline_progress,
    render_badge,
    render_labware_table,
    render_script_output,
    render_metrics_grid,
)


def render_developer_mode(llm_config: LLMConfig):
    st.markdown(
        '<div class="card"><div class="card-header">Developer Mode</div>'
        '<div style="color:var(--text-secondary);font-size:0.85rem;">'
        'Step-by-step validated pipeline: feasibility check, labware map review, '
        'code generation, syntax check, simulation, and outcome comparison.'
        '</div></div>',
        unsafe_allow_html=True,
    )

    # --- Input form ---
    procedure = st.text_area(
        "Procedure description *",
        height=140,
        placeholder="Perform a 1:2 serial dilution across 12 columns...",
        key="dev_procedure",
    )

    col_lab, col_exp = st.columns(2)
    with col_lab:
        labware_loc = st.text_area(
            "Labware & locations (optional)",
            height=80,
            placeholder="96-well plate at position 1, tip rack at position 2...",
            key="dev_labware",
        )
    with col_exp:
        expected = st.text_area(
            "Expected outcome (optional)",
            height=80,
            placeholder="Column 1: 200µL, Column 2: 100µL, ...",
            key="dev_expected",
        )

    run_btn = st.button("Run Pipeline", type="primary", use_container_width=True, key="dev_run")

    if run_btn:
        if not llm_config.api_key:
            st.error("Enter your API key in the sidebar.")
            return
        if not procedure:
            st.warning("Describe your procedure.")
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
        )

        st.markdown('<hr class="divider">', unsafe_allow_html=True)
        progress_placeholder = st.empty()
        results_container = st.container()

        run_log = PipelineRunLog(
            mode="developer",
            model=llm_config.model_name,
            input_prompt=procedure,
        )

        failed_step = None

        try:
            for state in run_developer_pipeline(provider, state):
                step = state.current_step

                with progress_placeholder:
                    render_pipeline_progress(step, failed_step)

                with results_container:
                    if step == PipelineStep.FEASIBILITY:
                        st.markdown('<div class="card-header">Feasibility Check</div>', unsafe_allow_html=True)
                        if state.feasibility_passed:
                            render_badge("Feasible", "pass")
                        else:
                            render_badge("Not Feasible", "fail")
                            failed_step = "feasibility"
                        st.markdown(
                            f'<div style="color:var(--text-secondary);font-size:0.85rem;margin:0.5rem 0;">'
                            f'{state.feasibility_result}</div>',
                            unsafe_allow_html=True,
                        )
                        if not state.feasibility_passed:
                            st.error("Pipeline stopped: procedure is not feasible.")
                            break

                    elif step == PipelineStep.LABWARE_MAP:
                        st.markdown('<div class="card-header">Labware Map</div>', unsafe_allow_html=True)
                        render_badge("Generated — Review Below", "info")
                        if state.labware_map and state.labware_map.items:
                            render_labware_table(state.labware_map.items)
                        if state.labware_map and state.labware_map.expected_outcome:
                            st.markdown(
                                f'**Expected outcome:** {state.labware_map.expected_outcome}',
                            )
                        if state.labware_map and state.labware_map.raw_text:
                            with st.expander("Raw labware map"):
                                st.code(state.labware_map.raw_text, language="json")

                    elif step == PipelineStep.CODE_GENERATION:
                        st.markdown('<div class="card-header">Generated Code</div>', unsafe_allow_html=True)
                        if state.generated_script:
                            st.code(state.generated_script, language="python")

                    elif step == PipelineStep.SYNTAX_CHECK:
                        st.markdown('<div class="card-header">Syntax Check</div>', unsafe_allow_html=True)
                        if state.syntax_passed:
                            render_badge("Passed", "pass")
                        else:
                            render_badge("Failed", "fail")
                            failed_step = "syntax_check"
                            for err in state.syntax_errors:
                                st.error(err)
                            st.warning("Pipeline stopped: syntax errors found.")

                    elif step == PipelineStep.SIMULATION:
                        st.markdown('<div class="card-header">Simulation</div>', unsafe_allow_html=True)
                        sim = state.simulation
                        if sim and sim.success:
                            render_badge("Passed", "pass")
                        else:
                            render_badge("Failed", "fail")
                            failed_step = "simulation"
                        if sim and sim.logs:
                            with st.expander("Simulator Logs"):
                                st.code(sim.logs, language="text")
                        if sim and sim.error:
                            st.error(f"Simulation error: {sim.error}")

                    elif step == PipelineStep.OUTCOME_COMPARISON:
                        st.markdown('<div class="card-header">Outcome Comparison</div>', unsafe_allow_html=True)
                        comp = state.comparison
                        if comp and comp.match:
                            render_badge(f"Match ({comp.tier_used})", "pass")
                        elif comp:
                            render_badge(f"Mismatch ({comp.tier_used})", "warn")
                        if comp and comp.report:
                            st.markdown(
                                f'<div style="color:var(--text-secondary);font-size:0.85rem;'
                                f'white-space:pre-wrap;margin:0.5rem 0;">{comp.report}</div>',
                                unsafe_allow_html=True,
                            )

                    elif step == PipelineStep.RESULTS:
                        st.markdown('<hr class="divider">', unsafe_allow_html=True)
                        st.markdown('<div class="card-header">Final Results</div>', unsafe_allow_html=True)
                        if state.final_passed:
                            render_badge("Pipeline Passed", "pass")
                        else:
                            render_badge("Pipeline Failed", "fail")

                        run_log.generated_code = state.generated_script
                        run_log.syntax_check_passed = state.syntax_passed
                        run_log.syntax_errors = state.syntax_errors
                        run_log.simulation_passed = state.simulation.success if state.simulation else False
                        run_log.simulation_logs = state.simulation.logs if state.simulation else ""
                        run_log.final_passed = state.final_passed
                        run_log.save()

                        if state.generated_script and state.final_passed:
                            render_script_output(state.generated_script)

        except Exception as e:
            st.error(f"Pipeline error: {e}")
