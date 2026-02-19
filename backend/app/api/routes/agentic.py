from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import LLMConfig, UserInput, PipelineState
from app.api.deps import get_provider
from app.core.pipeline import run_agentic_pipeline

router = APIRouter(prefix="/api/agentic", tags=["agentic"])


class AgenticRequest(BaseModel):
    user_input: UserInput
    llm_config: LLMConfig = LLMConfig()


@router.post("/run")
async def run_pipeline(req: AgenticRequest):
    provider = get_provider(req.llm_config)
    state = PipelineState(
        user_input=req.user_input,
        llm_config=req.llm_config,
        max_retries=req.user_input.max_retries,
    )
    try:
        final_event = {}
        async for event in run_agentic_pipeline(provider, state):
            final_event = event
        return final_event
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/stream")
async def stream_pipeline(
    goal: str,
    provider_name: str = "google",
    model_name: str = "gemini-2.0-flash",
    api_key: str = "",
    context: str = "",
    max_retries: int = 3,
):
    from app.config import Provider, Mode
    llm_config = LLMConfig(
        provider=Provider(provider_name),
        model_name=model_name,
        api_key=api_key or None,
    )
    user_input = UserInput(
        goal=goal,
        mode=Mode.AGENTIC,
        context=context or None,
        max_retries=max_retries,
    )
    prov = get_provider(llm_config)
    state = PipelineState(
        user_input=user_input,
        llm_config=llm_config,
        max_retries=max_retries,
    )

    async def event_stream():
        try:
            async for event in run_agentic_pipeline(prov, state):
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
