import streamlit as st

from config import Mode, MODE_DISPLAY_NAMES, MODE_DESCRIPTIONS
from ui.styles import GLOBAL_CSS
from ui.sidebar import render_sidebar
from ui.simple_mode import render_simple_mode
from ui.developer_mode import render_developer_mode
from ui.agentic_mode import render_agentic_mode

st.set_page_config(
    page_title="PyHamilton Agent",
    page_icon="🧬",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(GLOBAL_CSS, unsafe_allow_html=True)

llm_config = render_sidebar()

st.markdown(
    '<div class="app-header">'
    '<span class="logo">🧬</span>'
    '<h1>PyHamilton Automation Agent</h1>'
    '</div>'
    '<p class="app-subtitle">Generate, validate, and execute PyHamilton protocols with AI</p>',
    unsafe_allow_html=True,
)

if "active_mode" not in st.session_state:
    st.session_state.active_mode = Mode.SIMPLE

mode_cols = st.columns(3)
modes = list(Mode)
for col, mode in zip(mode_cols, modes):
    with col:
        is_active = st.session_state.active_mode == mode
        if st.button(
            f"**{MODE_DISPLAY_NAMES[mode]}**\n\n{MODE_DESCRIPTIONS[mode]}",
            key=f"mode_{mode.value}",
            use_container_width=True,
            type="primary" if is_active else "secondary",
        ):
            st.session_state.active_mode = mode
            st.rerun()

st.markdown('<hr class="divider">', unsafe_allow_html=True)

active = st.session_state.active_mode
if active == Mode.SIMPLE:
    render_simple_mode(llm_config)
elif active == Mode.DEVELOPER:
    render_developer_mode(llm_config)
elif active == Mode.AGENTIC:
    render_agentic_mode(llm_config)
