from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# Type alias for database session to avoid FastAPI issues
DbSession = AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models import UserSettings, User
from app.api.deps_auth import get_current_active_user
from app.core.responses import ApiResponse

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Valid providers
AI_PROVIDERS = ["anthropic", "openai", "google"]


# Pydantic schemas
class UserSettingsUpdate(BaseModel):
    api_key: Optional[str] = Field(None, max_length=500)
    selected_model: Optional[str] = Field(None, max_length=200)
    preferences: Optional[dict] = None


class UserSettingsResponse(BaseModel):
    id: int
    user_id: int
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


class ActiveProviderResponse(BaseModel):
    """Response for the active provider endpoint."""
    provider: str
    model_name: Optional[str]
    has_api_key: bool
    preferences: dict


# Endpoints
@router.get("/active/provider")
async def get_active_provider(
    current_user: User = Depends(get_current_active_user),
    db: DbSession = Depends(get_db)
):
    """Get the active provider configuration for the current user."""
    try:
        # Find the first provider with an API key for this user
        result = await db.execute(
            select(UserSettings).where(
                UserSettings.user_id == current_user.id,
                UserSettings.api_key.is_not(None)
            ).order_by(UserSettings.updated_at.desc())
        )
        settings = result.scalar_one_or_none()

        if settings:
            return ApiResponse.success(
                data={
                    "provider": settings.provider,
                    "model_name": settings.selected_model,
                    "has_api_key": True,
                    "preferences": settings.preferences or {}
                },
                message="Active provider retrieved successfully"
            )

        # Fallback to Google if no API keys configured
        return ApiResponse.success(
            data={
                "provider": "google",
                "model_name": "gemini-2.0-flash",
                "has_api_key": False,
                "preferences": {}
            },
            message="No active provider found, using default"
        )
    except Exception as e:
        return ApiResponse.error(
            message=f"Failed to get active provider: {str(e)}",
            status_code=500
        )


@router.get("")
async def get_all_settings(
    current_user: User = Depends(get_current_active_user),
    db: DbSession = Depends(get_db)
):
    """Get all settings for the current user."""
    try:
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == current_user.id)
        )
        settings_list = result.scalars().all()

        settings_dict = {
            setting.provider: UserSettingsResponse.model_validate(setting.to_dict()).model_dump()
            for setting in settings_list
        }

        return ApiResponse.success(
            data=settings_dict,
            message="Settings retrieved successfully"
        )
    except Exception as e:
        return ApiResponse.error(
            message=f"Failed to get settings: {str(e)}",
            status_code=500
        )


@router.get("/{provider}")
async def get_provider_settings(
    provider: str,
    current_user: User = Depends(get_current_active_user),
    db: DbSession = Depends(get_db)
):
    """Get settings for a specific provider for the current user."""
    try:
        if provider not in AI_PROVIDERS:
            return ApiResponse.validation_error(
                message=f"Invalid provider: {provider}",
                errors={"provider": f"Must be one of: {', '.join(AI_PROVIDERS)}"}
            )

        result = await db.execute(
            select(UserSettings).where(
                UserSettings.user_id == current_user.id,
                UserSettings.provider == provider
            )
        )
        settings = result.scalar_one_or_none()

        if not settings:
            # Return empty settings
            empty_settings = UserSettingsResponse(
                id=0,
                user_id=current_user.id,
                provider=provider,
                api_key=None,
                selected_model=None,
                models_list=None,
                models_fetched_at=None,
                preferences={},
                created_at=datetime.utcnow().isoformat(),
                updated_at=datetime.utcnow().isoformat(),
            )
            return ApiResponse.success(
                data=empty_settings.model_dump(),
                message="No settings found for this provider"
            )

        return ApiResponse.success(
            data=UserSettingsResponse.model_validate(settings.to_dict()).model_dump(),
            message="Settings retrieved successfully"
        )
    except Exception as e:
        return ApiResponse.error(
            message=f"Failed to get provider settings: {str(e)}",
            status_code=500
        )


@router.put("/{provider}")
async def update_provider_settings(
    provider: str,
    settings_update: UserSettingsUpdate,
    current_user: User = Depends(get_current_active_user),
    db: DbSession = Depends(get_db)
):
    """Update settings for a specific provider for the current user."""
    try:
        if provider not in AI_PROVIDERS:
            return ApiResponse.validation_error(
                message=f"Invalid provider: {provider}",
                errors={"provider": f"Must be one of: {', '.join(AI_PROVIDERS)}"}
            )

        result = await db.execute(
            select(UserSettings).where(
                UserSettings.user_id == current_user.id,
                UserSettings.provider == provider
            )
        )
        settings = result.scalar_one_or_none()

        if not settings:
            settings = UserSettings(
                user_id=current_user.id,
                provider=provider,
                api_key=None,
                selected_model=None,
                models_list=None,
                models_fetched_at=None,
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

        return ApiResponse.success(
            data=UserSettingsResponse.model_validate(settings.to_dict()).model_dump(),
            message="Settings updated successfully"
        )
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(
            message=f"Failed to update settings: {str(e)}",
            status_code=500
        )


@router.post("/{provider}/models")
async def update_provider_models(
    provider: str,
    models_list: dict,
    current_user: User = Depends(get_current_active_user),
    db: DbSession = Depends(get_db)
):
    """Update the models list for a provider for the current user."""
    try:
        if provider not in AI_PROVIDERS:
            return ApiResponse.validation_error(
                message=f"Invalid provider: {provider}",
                errors={"provider": f"Must be one of: {', '.join(AI_PROVIDERS)}"}
            )

        result = await db.execute(
            select(UserSettings).where(
                UserSettings.user_id == current_user.id,
                UserSettings.provider == provider
            )
        )
        settings = result.scalar_one_or_none()

        if not settings:
            settings = UserSettings(
                user_id=current_user.id,
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

        return ApiResponse.success(
            data={
                "provider": provider,
                "models_list": settings.models_list or {},
                "models_fetched_at": settings.models_fetched_at.isoformat()
            },
            message="Models list updated successfully"
        )
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(
            message=f"Failed to update models: {str(e)}",
            status_code=500
        )


@router.delete("/{provider}")
async def delete_provider_settings(
    provider: str,
    current_user: User = Depends(get_current_active_user),
    db: DbSession = Depends(get_db)
):
    """Delete settings for a specific provider for the current user."""
    try:
        if provider not in AI_PROVIDERS:
            return ApiResponse.validation_error(
                message=f"Invalid provider: {provider}",
                errors={"provider": f"Must be one of: {', '.join(AI_PROVIDERS)}"}
            )

        await db.execute(
            delete(UserSettings).where(
                UserSettings.user_id == current_user.id,
                UserSettings.provider == provider
            )
        )
        await db.commit()

        return ApiResponse.success(
            data={"deleted": True},
            message="Settings deleted successfully"
        )
    except Exception as e:
        await db.rollback()
        return ApiResponse.error(
            message=f"Failed to delete settings: {str(e)}",
            status_code=500
        )