import streamlit as st
from pathlib import Path

from config import (
    Provider, PROVIDER_DISPLAY_NAMES, PROVIDER_MODELS, LLMConfig,
)


def render_sidebar() -> LLMConfig:
    """Render the sidebar and return LLM configuration."""
    with st.sidebar:
        st.markdown("## Settings")

        # --- YAML config ---
        config_path = Path("llm_config.yaml")
        use_yaml = config_path.exists()

        if use_yaml:
            st.caption(f"Config loaded from `{config_path}`")
            try:
                config = LLMConfig.from_yaml(str(config_path))
            except Exception as e:
                st.error(f"Failed to load config: {e}")
                config = LLMConfig()
                use_yaml = False

        if not use_yaml:
            config = LLMConfig()

        st.markdown("#### LLM Provider")

        provider_options = list(PROVIDER_DISPLAY_NAMES.values())
        provider_keys = list(PROVIDER_DISPLAY_NAMES.keys())
        default_idx = provider_keys.index(config.provider) if config.provider in provider_keys else 0

        selected_label = st.selectbox(
            "Provider",
            provider_options,
            index=default_idx,
            label_visibility="collapsed",
        )
        provider = provider_keys[provider_options.index(selected_label)]
        config.provider = provider

        api_key = st.text_input(
            "API Key",
            value=config.api_key,
            type="password",
            placeholder="sk-... or AIza...",
        )
        config.api_key = api_key

        if provider == Provider.OPENROUTER:
            model_name = st.text_input(
                "Model",
                value=config.model_name if config.model_name else "anthropic/claude-sonnet-4-20250514",
                help="OpenRouter model path, e.g. anthropic/claude-3.5-sonnet",
            )
        else:
            models = PROVIDER_MODELS.get(provider, [])
            default_model_idx = 0
            if config.model_name in models:
                default_model_idx = models.index(config.model_name)
            model_name = st.selectbox("Model", models, index=default_model_idx)

        config.model_name = model_name

        st.markdown("---")

        st.markdown("#### Generation")
        config.temperature = st.slider(
            "Temperature",
            min_value=0.0,
            max_value=1.0,
            value=config.temperature,
            step=0.05,
        )
        config.max_tokens = st.select_slider(
            "Max tokens",
            options=[2048, 4096, 8192, 16384],
            value=config.max_tokens if config.max_tokens in [2048, 4096, 8192, 16384] else 4096,
        )

        st.markdown("---")
        st.markdown(
            "<div style='text-align:center; font-size:0.7rem; color:#6e7681; padding:0.5rem 0;'>"
            "PyHamilton Automation Agent v2.0"
            "</div>",
            unsafe_allow_html=True,
        )

    return config
