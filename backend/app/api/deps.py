from __future__ import annotations

import os

from fastapi import Header, HTTPException

from app.config import Provider, LLMConfig, PROVIDER_MODELS
from app.providers.base import BaseLLMProvider
from app.providers.factory import create_provider

ENV_KEY_MAP = {
    Provider.GOOGLE: "GOOGLE_API_KEY",
    Provider.OPENAI: "OPENAI_API_KEY",
    Provider.ANTHROPIC: "ANTHROPIC_API_KEY",
    Provider.OPENROUTER: "OPENROUTER_API_KEY",
}


def get_provider(
    llm_config: LLMConfig,
    x_api_key: str | None = Header(default=None),
) -> BaseLLMProvider:
    api_key = (
        llm_config.api_key
        or x_api_key
        or os.getenv(ENV_KEY_MAP.get(llm_config.provider, ""), "")
    )
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail=f"No API key provided for {llm_config.provider.value}. "
            f"Set {ENV_KEY_MAP.get(llm_config.provider, 'UNKNOWN')} env var or pass via header/body.",
        )
    return create_provider(
        provider=llm_config.provider,
        api_key=api_key,
        model_name=llm_config.model_name,
    )
