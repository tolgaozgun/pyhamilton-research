from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

DbSession = AsyncSession

from app.config import LLMConfig, UserInput, PipelineState
from app.api.deps import get_provider
from app.api.deps_auth import get_current_active_user
from app.core.pipeline import run_developer_pipeline
from app.models.user import User
from app.database import get_db
from app.core.responses import ApiResponse

router = APIRouter(prefix="/api/developer", tags=["developer"])


class DeveloperRequest(BaseModel):
    user_input: UserInput
    llm_config: LLMConfig = LLMConfig()


@router.post("/run")
async def run_pipeline(
    req: DeveloperRequest,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    provider = await get_provider(req.llm_config, db, user_id=current_user.id)
    state = PipelineState(user_input=req.user_input, llm_config=req.llm_config)
    try:
        final_state = state
        async for step_state in run_developer_pipeline(provider, state):
            final_state = step_state
        return ApiResponse.success(data=final_state.model_dump(), message="Pipeline completed successfully")
    except Exception as exc:
        return ApiResponse.error(message=str(exc), status_code=500)
