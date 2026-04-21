from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# Type alias for database session to avoid FastAPI issues
DbSession = AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

from app.database import get_db
from app.models import UserSettings

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Valid providers
AI_PROVIDERS = ["anthropic", "openai", "google"]


# Pydantic schemas
class UserSettingsCreate(BaseModel):
    provider: str = Field(..., min_length=1, max_length=50)
    api_key: Optional[str] = Field(None, max_length=500)


class UserSettingsUpdate(BaseModel):
    api_key: Optional[str] = Field(None, max_length=500)
    selected_model: Optional[str] = Field(None, max_length=200)
    preferences: Optional[dict] = None


class UserSettingsResponse(BaseModel):
    id: int
    user_id: str
    provider: str
    api_key: Optional[str]
    selected_model: Optional[str]
    models_list: Optional[dict]
    models_fetched_at: Optional[str]
    preferences: dict
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ModelsRefreshResponse(BaseModel):
    provider: str
    models_list: dict
    models_fetched_at: str


# Endpoints
@router.get("", response_model=dict[str, UserSettingsResponse])
async def get_all_settings(
    user_id: str = "default",
    db: DbSession = Depends(get_db)
):
    """Get all settings for a user"""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings_list = result.scalars().all()

    return {
        setting.provider: UserSettingsResponse.model_validate(setting.to_dict())
        for setting in settings_list
    }


@router.get("/active/provider", response_model=dict)
async def get_active_provider(
    user_id: str = "default",
    db: DbSession = Depends(get_db)
):
    """Get the active provider configuration (first provider with API key)"""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings_list = result.scalars().all()

    # Find the first provider with an API key
    for setting in settings_list:
        if setting.api_key:
            return {
                "provider": setting.provider,
                "model_name": setting.selected_model,
                "has_api_key": True,
                "preferences": setting.preferences
            }

    # Fallback to Google if no API keys configured
    return {
        "provider": "google",
        "model_name": "gemini-2.0-flash",
        "has_api_key": False,
        "preferences": {}
    }


@router.get("/{provider}", response_model=UserSettingsResponse)
async def get_provider_settings(
    provider: str,
    user_id: str = "default",
    db: DbSession = Depends(get_db)
):
    """Get settings for a specific provider"""
    if provider not in AI_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    result = await db.execute(
        select(UserSettings).where(
            UserSettings.user_id == user_id,
            UserSettings.provider == provider
        )
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Return empty settings
        return UserSettingsResponse(
            id=0,
            user_id=user_id,
            provider=provider,
            api_key=None,
            selected_model=None,
            models_list=None,
            models_fetched_at=None,
            preferences={},
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
        )

    return UserSettingsResponse.model_validate(settings.to_dict())


@router.put("/{provider}", response_model=UserSettingsResponse)
async def update_provider_settings(
    provider: str,
    settings_update: UserSettingsUpdate,
    user_id: str = "default",
    db: DbSession = Depends(get_db)
):
    """Update settings for a specific provider"""
    if provider not in AI_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    result = await db.execute(
        select(UserSettings).where(
            UserSettings.user_id == user_id,
            UserSettings.provider == provider
        )
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(
            user_id=user_id,
            provider=provider,
            api_key=None,
            selected_model=None,
            models_list=None,
            preferences={}
        )
        db.add(settings)

    # Update provided fields
    update_data = settings_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    settings.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(settings)

    return UserSettingsResponse.model_validate(settings.to_dict())


@router.post("/{provider}/models", response_model=ModelsRefreshResponse)
async def update_provider_models(
    provider: str,
    models_list: dict,
    user_id: str = "default",
    db: DbSession = Depends(get_db)
):
    """Update the models list for a provider"""
    if provider not in AI_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    result = await db.execute(
        select(UserSettings).where(
            UserSettings.user_id == user_id,
            UserSettings.provider == provider
        )
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(
            user_id=user_id,
            provider=provider,
            api_key=None,
            selected_model=None,
            models_list=models_list,
            models_fetched_at=datetime.utcnow(),
            preferences={}
        )
        db.add(settings)
    else:
        settings.models_list = models_list
        settings.models_fetched_at = datetime.utcnow()

    await db.commit()
    await db.refresh(settings)

    return ModelsRefreshResponse(
        provider=provider,
        models_list=settings.models_list or {},
        models_fetched_at=settings.models_fetched_at.isoformat()
    )


@router.delete("/{provider}")
async def delete_provider_settings(
    provider: str,
    user_id: str = "default",
    db: DbSession = Depends(get_db)
):
    """Delete settings for a specific provider"""
    if provider not in AI_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    await db.execute(
        delete(UserSettings).where(
            UserSettings.user_id == user_id,
            UserSettings.provider == provider
        )
    )
    await db.commit()

    return None
