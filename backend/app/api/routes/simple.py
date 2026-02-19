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

router = APIRouter(prefix="/api/simple", tags=["simple"])


class SimpleRequest(BaseModel):
    user_input: UserInput
    llm_config: LLMConfig = LLMConfig()


@router.post("/generate")
async def generate(req: SimpleRequest):
    provider = get_provider(req.llm_config)
    try:
        script = await run_simple_pipeline(provider, req.user_input, req.llm_config)
        return {"script": script}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/stream")
async def stream_generate(
    goal: str,
    provider_name: str = "google",
    model_name: str = "gemini-2.0-flash",
    api_key: str = "",
):
    from app.config import Provider
    llm_config = LLMConfig(
        provider=Provider(provider_name),
        model_name=model_name,
        api_key=api_key or None,
    )
    prov = get_provider(llm_config)

    system_prompt = get_system_prompt("simple")
    rag_context = format_rag_context(goal)
    prompt = build_simple_prompt(goal, rag_context=rag_context)

    async def event_stream():
        try:
            async for chunk in prov.generate_stream(prompt, system_prompt=system_prompt):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
