"""Simple Mode UI — prompt in, file out. No validation, no friction."""

import streamlit as st

from config import LLMConfig, UserInput
from core.pipeline import run_simple_pipeline, run_simple_pipeline_stream, _extract_code
from providers.factory import create_provider
from ui.components import render_script_output


def render_simple_mode(llm_config: LLMConfig):
    st.markdown(
        '<div class="card"><div class="card-header">Simple Mode</div>'
        '<div style="color:var(--text-secondary);font-size:0.85rem;">'
        'Describe your protocol and get a ready-to-run PyHamilton script. '
        'No validation steps — just fast generation with RAG-enhanced quality.'
        '</div></div>',
        unsafe_allow_html=True,
    )

    procedure = st.text_area(
        "Describe your protocol",
        height=160,
        placeholder=(
            "Perform a 1:2 serial dilution across 12 columns of a 96-well plate, "
            "starting from column 1 with 200µL of sample."
        ),
        key="simple_procedure",
    )

    col_btn, col_stream = st.columns([1, 1])
    with col_btn:
        generate = st.button("Generate Script", type="primary", use_container_width=True, key="simple_gen")
    with col_stream:
        stream_mode = st.checkbox("Stream output", value=True, key="simple_stream")

    if generate:
        if not llm_config.api_key:
            st.error("Enter your API key in the sidebar.")
            return
        if not procedure:
            st.warning("Describe your protocol first.")
            return

        user_input = UserInput(procedure=procedure)
        provider = create_provider(llm_config.provider, llm_config.api_key, llm_config.model_name)

        st.markdown('<hr class="divider">', unsafe_allow_html=True)

        if stream_mode:
            st.markdown(
                '<div class="card-header" style="margin-bottom:0.5rem;">Generated Script</div>',
                unsafe_allow_html=True,
            )
            full_text = ""
            placeholder = st.empty()
            try:
                for chunk in run_simple_pipeline_stream(provider, user_input, llm_config):
                    full_text += chunk
                    placeholder.code(_extract_code(full_text) if "```" in full_text else full_text, language="python")

                script = _extract_code(full_text)
                placeholder.empty()
                render_script_output(script)
            except Exception as e:
                st.error(f"Generation failed: {e}")
        else:
            with st.spinner("Generating..."):
                try:
                    script, log = run_simple_pipeline(provider, user_input, llm_config)
                    st.markdown(
                        '<div class="card-header" style="margin-bottom:0.5rem;">Generated Script</div>',
                        unsafe_allow_html=True,
                    )
                    render_script_output(script)
                except Exception as e:
                    st.error(f"Generation failed: {e}")
