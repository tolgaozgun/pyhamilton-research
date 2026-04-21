from __future__ import annotations

import os
from typing import Optional, Union

from fastapi import Header, HTTPException, Depends
from sqlalchemy import select

from app.config import Provider, LLMConfig, PROVIDER_MODELS
from app.providers.base import BaseLLMProvider
from app.providers.factory import create_provider
from app.database import get_db, DbSession
from app.models import UserSettings, User
from app.api.deps_auth import get_current_active_user


ENV_KEY_MAP = {
    Provider.GOOGLE: "GOOGLE_API_KEY",
    Provider.OPENAI: "OPENAI_API_KEY",
    Provider.ANTHROPIC: "ANTHROPIC_API_KEY",
    Provider.OPENROUTER: "OPENROUTER_API_KEY",
}


async def _get_api_key_from_db(
    provider: Provider,
    user_id: int,
    db,
) -> Optional[str]:
    """Fetch API key from database for a given provider and user."""
    try:
        result = await db.execute(
            select(UserSettings).where(
                UserSettings.user_id == user_id,
                UserSettings.provider == provider.value,
            )
        )
        settings = result.scalar_one_or_none()
        if settings and settings.api_key:
            return settings.api_key
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to fetch API key from DB: {e}")
    return None


async def get_provider(
    llm_config: LLMConfig,
    db=None,
    user_id: Optional[int] = None,
) -> BaseLLMProvider:
    """
    Resolve a provider instance.

    Key resolution order:
    1. Database (user's saved settings) — requires user_id + db
    2. Environment variables (global fallback)
    """
    api_key: Optional[str] = None

    if db is not None and user_id is not None:
        api_key = await _get_api_key_from_db(llm_config.provider, user_id, db)

    if not api_key:
        api_key = os.getenv(ENV_KEY_MAP.get(llm_config.provider, ""), "") or None

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No API key configured for {llm_config.provider.value}. "
                "Please save your API key in Settings."
            ),
        )

    return create_provider(
        provider=llm_config.provider,
        api_key=api_key,
        model_name=llm_config.model_name,
    )
