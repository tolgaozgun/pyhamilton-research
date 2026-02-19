from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import LLMConfig, UserInput
from app.api.deps import get_provider
from app.core.pipeline import run_simple_pipeline
from app.prompts.system import get_system_prompt
from app.prompts.templates import build_simple_prompt
from app.core.rag import format_rag_context
from app.deck import DeckConfiguration

router = APIRouter(prefix="/api/simple", tags=["simple"])


class SimpleRequest(BaseModel):
    user_input: UserInput
    llm_config: LLMConfig = LLMConfig()


def _deck_context(req: SimpleRequest) -> str:
    """Extract deck configuration prompt context from request, if present."""
    if req.user_input.deck_config:
        try:
            deck = DeckConfiguration(**req.user_input.deck_config)
            return deck.to_prompt_context()
        except Exception:
            return ""
    return ""


@router.post("/generate")
async def generate(req: SimpleRequest):
    provider = get_provider(req.llm_config)
    try:
        deck_ctx = _deck_context(req)
        extra_context = req.user_input.context or ""
        if deck_ctx:
            extra_context = f"{extra_context}\n\n{deck_ctx}".strip()
        patched_input = req.user_input.model_copy(update={"context": extra_context or None})
        script = await run_simple_pipeline(provider, patched_input, req.llm_config)
        return {"script": script}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/stream")
async def stream_generate(req: SimpleRequest):
    prov = get_provider(req.llm_config)

    deck_ctx = _deck_context(req)
    extra_context = req.user_input.context or ""
    if deck_ctx:
        extra_context = f"{extra_context}\n\n{deck_ctx}".strip()

    system_prompt = get_system_prompt("simple")
    rag_context = format_rag_context(req.user_input.goal)
    prompt = build_simple_prompt(req.user_input.goal, extra_context or None, rag_context=rag_context)

    async def event_stream():
        try:
            async for chunk in prov.generate_stream(prompt, system_prompt=system_prompt):
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
