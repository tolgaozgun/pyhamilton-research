"""Reusable UI components."""

import streamlit as st
from config import PipelineStep, PIPELINE_STEP_LABELS, PipelineState


def render_pipeline_progress(current_step: PipelineStep, failed_step: str | None = None):
    """Render the pipeline step progress bar."""
    steps = list(PIPELINE_STEP_LABELS.items())
    icons = {
        PipelineStep.INPUT: "1",
        PipelineStep.FEASIBILITY: "2",
        PipelineStep.LABWARE_MAP: "3",
        PipelineStep.CODE_GENERATION: "4",
        PipelineStep.SYNTAX_CHECK: "5",
        PipelineStep.SIMULATION: "6",
        PipelineStep.OUTCOME_COMPARISON: "7",
        PipelineStep.RESULTS: "8",
    }
    done_icons = {
        PipelineStep.INPUT: "&#10003;",
        PipelineStep.FEASIBILITY: "&#10003;",
        PipelineStep.LABWARE_MAP: "&#10003;",
        PipelineStep.CODE_GENERATION: "&#10003;",
        PipelineStep.SYNTAX_CHECK: "&#10003;",
        PipelineStep.SIMULATION: "&#10003;",
        PipelineStep.OUTCOME_COMPARISON: "&#10003;",
        PipelineStep.RESULTS: "&#10003;",
    }

    current_idx = [s[0] for s in steps].index(current_step) if current_step in [s[0] for s in steps] else -1

    html = '<div class="pipeline-steps">'
    for i, (step_key, step_label) in enumerate(steps):
        if step_key.value == failed_step:
            cls = "failed"
            icon = "&#10007;"
        elif i < current_idx:
            cls = "done"
            icon = done_icons.get(step_key, "&#10003;")
        elif i == current_idx:
            cls = "active"
            icon = icons.get(step_key, str(i + 1))
        else:
            cls = ""
            icon = icons.get(step_key, str(i + 1))

        html += f'<div class="pipeline-step {cls}">'
        html += f'<span class="step-icon">{icon}</span>'
        html += f'{step_label}'
        html += '</div>'
    html += '</div>'

    st.markdown(html, unsafe_allow_html=True)


def render_badge(text: str, variant: str = "info"):
    """Render a status badge. variant: pass, fail, warn, info, running."""
    st.markdown(f'<span class="badge badge-{variant}">{text}</span>', unsafe_allow_html=True)


def render_metrics_grid(metrics: dict):
    """Render a metrics grid from a dict of label→value."""
    html = '<div class="metric-grid">'
    for label, value in metrics.items():
        html += f'<div class="metric-item"><div class="value">{value}</div><div class="label">{label}</div></div>'
    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)


def render_labware_table(items: list[dict]):
    """Render labware map as a styled table."""
    if not items:
        return
    html = '<table class="labware-table"><thead><tr>'
    html += '<th>Position</th><th>Name</th><th>Type</th><th>Description</th>'
    html += '</tr></thead><tbody>'
    for item in items:
        pos = item.get("deck_position", "—")
        name = item.get("name", "—")
        ltype = item.get("type", "—")
        desc = item.get("description", "")
        html += f'<tr><td>{pos}</td><td>{name}</td><td>{ltype}</td><td>{desc}</td></tr>'
    html += '</tbody></table>'
    st.markdown(html, unsafe_allow_html=True)


def render_event(event_type: str, title: str, content: str = ""):
    """Render an agent event log entry."""
    cls = {
        "step": "step",
        "retry": "retry",
        "success": "success",
        "error": "error",
    }.get(event_type, "step")

    html = f'<div class="event-item {cls}">'
    html += f'<div class="event-label" style="color:inherit;">{title}</div>'
    if content:
        html += f'<div style="color:var(--text-secondary);font-size:0.8rem;">{content[:500]}</div>'
    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)


def render_script_output(script: str, filename: str = "generated_protocol.py"):
    """Render script with download button."""
    st.code(script, language="python")
    st.download_button(
        label="Download Script",
        data=script,
        file_name=filename,
        mime="text/x-python",
        use_container_width=True,
    )
