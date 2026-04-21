from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

DbSession = AsyncSession

from app.config import LLMConfig, UserInput
from app.api.deps import get_provider
from app.api.deps_auth import get_current_active_user
from app.core.pipeline import run_simple_pipeline
from app.models.user import User
from app.deck import DeckConfiguration
from app.database import get_db
from app.core.responses import ApiResponse

router = APIRouter(prefix="/api/simple", tags=["simple"])


class SimpleRequest(BaseModel):
    user_input: UserInput
    llm_config: LLMConfig = LLMConfig()


def _deck_context(req: SimpleRequest) -> str:
    if req.user_input.deck_config:
        try:
            deck = DeckConfiguration(**req.user_input.deck_config)
            return deck.to_prompt_context()
        except Exception:
            return ""
    return ""


@router.post("/generate")
async def generate(
    req: SimpleRequest,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    provider = await get_provider(req.llm_config, db, user_id=current_user.id)
    try:
        deck_ctx = _deck_context(req)
        extra_context = req.user_input.context or ""
        if deck_ctx:
            extra_context = f"{extra_context}\n\n{deck_ctx}".strip()
        patched_input = req.user_input.model_copy(update={"context": extra_context or None})
        script = await run_simple_pipeline(provider, patched_input, req.llm_config)
        return ApiResponse.success(data={"script": script}, message="Script generated successfully")
    except Exception as exc:
        return ApiResponse.error(message=str(exc), status_code=500)
