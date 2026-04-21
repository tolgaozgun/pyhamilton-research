from __future__ import annotations

import logging
import re
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

# Type alias for database session to avoid FastAPI issues
DbSession = AsyncSession

from app.api.deps import get_provider
from app.api.deps_auth import get_current_active_user
from app.config import LLMConfig
from app.core.responses import ApiResponse
from app.models.user import User
from app.core.agentic_runtime import run_python_interpreter, run_pytest_suite
from app.core.rag import format_rag_context, search_vector_store_context
from app.core.safety import run_syntax_check
from app.deck import DeckConfiguration
from app.prompts.system import get_system_prompt
from app.prompts.templates import (
    build_agentic_chat_prompt,
    build_agentic_fix_prompt,
    build_agentic_generation_prompt,
    build_agentic_validate_prompt,
)
from app.database import get_db

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

router = APIRouter(prefix="/api/agentic", tags=["agentic"])
AgenticPhase = Literal["procedure", "generation"]


class ClarifyMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ClarifyRequest(BaseModel):
    goal: str
    conversation: list[ClarifyMessage] = []
    llm_config: LLMConfig = LLMConfig()
    deck_context: Optional[str] = None
    deck_config: Optional[dict] = None


class AgenticChatRequest(BaseModel):
    phase: AgenticPhase
    goal: str
    conversation: list[ClarifyMessage] = []
    llm_config: LLMConfig = LLMConfig()
    deck_config: Optional[dict] = None
    procedure_context: Optional[str] = None
    generation_context: Optional[str] = None
    vector_store_id: Optional[str] = None


class AgenticChatResponse(BaseModel):
    ready: bool
    question: Optional[str] = None
    summary: Optional[str] = None


class AgenticGenerationRequest(BaseModel):
    goal: str
    deck_config: Optional[dict] = None
    procedure_context: Optional[str] = None
    llm_config: LLMConfig = LLMConfig()
    vector_store_id: Optional[str] = None


class AgenticGenerationResponse(BaseModel):
    script: str
    tests: str
    notes: Optional[str] = None


class AgenticVerificationRequest(BaseModel):
    script: str
    tests: str


class AgenticValidateRequest(BaseModel):
    phase: AgenticPhase
    goal: str
    deck_config: Optional[dict] = None
    procedure_context: Optional[str] = None
    llm_config: LLMConfig = LLMConfig()
    vector_store_id: Optional[str] = None


class AgenticValidateResponse(BaseModel):
    valid: bool
    feedback: str


class AgenticFixRequest(BaseModel):
    goal: str
    deck_config: Optional[dict] = None
    procedure_context: Optional[str] = None
    script: str
    tests: str
    verification_feedback: str = ""
    llm_config: LLMConfig = LLMConfig()
    vector_store_id: Optional[str] = None


class VerificationArtifact(BaseModel):
    passed: bool
    exit_code: int
    stdout: str
    stderr: str
    command: str


class AgenticVerificationResponse(BaseModel):
    syntax: VerificationArtifact
    interpreter: VerificationArtifact
    pytest: VerificationArtifact
    passed: bool
    feedback: str


def _conversation_text(conversation: list[ClarifyMessage]) -> str:
    lines: list[str] = []
    for message in conversation:
        speaker = "Scientist" if message.role == "user" else "Assistant"
        lines.append(f"{speaker}: {message.content}")
    return "\n".join(lines).strip()


def _deck_context(deck_config: Optional[dict]) -> str:
    if not deck_config:
        return ""
    try:
        deck = DeckConfiguration.model_validate(deck_config)
    except Exception:
        return ""
    return deck.to_prompt_context()


def _extract_code_blocks(text: str) -> list[str]:
    blocks = re.findall(r"```(?:python|py)?\s*\n(.*?)```", text, re.DOTALL | re.IGNORECASE)
    return [block.strip() for block in blocks if block.strip()]


def _normalize_ready_response(text: str) -> AgenticChatResponse:
    logger.info(f"🔍 _normalize_ready_response called with text: {text[:200]}...")

    cleaned = text.strip()
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]

    logger.info(f"📝 Cleaned text: {cleaned[:200]}...")
    logger.info(f"📋 Lines count: {len(lines)}, First few lines: {lines[:5]}")

    # Check if response starts with "READY" (case-insensitive)
    ready = cleaned.upper().startswith("READY")

    logger.info(f"🎯 Ready check: starts with 'READY'? {ready}")

    if ready:
        summary = lines[1] if len(lines) > 1 else ""
        logger.info(f"✅ Response is READY. Summary: {summary[:200]}...")
        logger.info(f"📊 Returning AgenticChatResponse(ready=True, summary='{summary[:100]}...')")
        return AgenticChatResponse(ready=True, summary=summary or cleaned)

    logger.info(f"❓ Response is NOT READY. Returning as question.")
    logger.info(f"📊 Returning AgenticChatResponse(ready=False, question='{cleaned[:100]}...')")
    return AgenticChatResponse(ready=False, question=cleaned)


def _get_labware_system_context(deck_config: Optional[dict]) -> str:
    """Extract carrier and labware context from the selected deck layout configuration."""
    if not deck_config:
        return ""

    carriers = deck_config.get("carriers", [])
    if not carriers:
        return ""

    lines: list[str] = []
    seen_labware: set[str] = set()

    lines.append("### Carriers on Deck")
    for carrier in carriers:
        carrier_type = carrier.get("carrier_type", "unknown")
        start_rail = carrier.get("start_rail", "?")
        lines.append(f"- {carrier_type} starting at rail {start_rail}")

    lines.append("### Labware on Deck")
    for carrier in carriers:
        carrier_type = carrier.get("carrier_type", "unknown")
        for i, slot in enumerate(carrier.get("slots", []), start=1):
            if not slot:
                continue
            code = slot.get("subtype", "")
            name = slot.get("name", code)
            category = slot.get("type", "unknown")
            if code and code not in seen_labware:
                seen_labware.add(code)
                lines.append(f"- {name} (code: {code}, category: {category})")

    return "\n".join(lines)


def _verification_feedback(
    syntax_report: dict,
    interpreter_report: dict,
    pytest_report: dict,
) -> str:
    feedback: list[str] = []
    if not syntax_report["passed"]:
        feedback.append("Script syntax check failed:")
        feedback.append(syntax_report["stderr"] or syntax_report["stdout"] or "Syntax check failed.")
    if not interpreter_report["passed"]:
        feedback.append("Interpreter execution failed:")
        feedback.append(interpreter_report["stderr"] or interpreter_report["stdout"] or "Interpreter run failed.")
    if not pytest_report["passed"]:
        feedback.append("Pytest run failed:")
        feedback.append(pytest_report["stderr"] or pytest_report["stdout"] or "Pytest failed.")
    return "\n".join(feedback).strip()


@router.post("/validate")
async def validate_phase(
    req: AgenticValidateRequest,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """AI-driven step validation. Returns valid=True/False + actionable feedback."""
    logger.info("=" * 80)
    logger.info("VALIDATE PHASE REQUEST STARTED")
    logger.info(f"Phase: {req.phase}")
    logger.info(f"Goal: {req.goal[:100]}...")  # First 100 chars
    logger.info(f"LLM Config: provider={req.llm_config.provider}, model={req.llm_config.model_name}")
    logger.info(f"Deck config present: {req.deck_config is not None}")
    logger.info(f"Procedure context present: {req.procedure_context is not None}")

    deck_ctx = _deck_context(req.deck_config)
    logger.info(f"Deck context length: {len(deck_ctx)} characters")

    # For deck_layout, run the structural check first for free
    if req.phase == "deck_layout" and req.deck_config:
        logger.info("Running deck_layout structural validation...")
        try:
            from app.deck import CARRIER_INFO
            occupied: set[int] = set()
            struct_errors: list[str] = []
            from app.deck import DeckConfiguration as _DC
            deck_model = _DC.model_validate(req.deck_config)
            logger.info(f"Deck has {len(deck_model.carriers)} carriers")
            for cp in deck_model.carriers:
                info = CARRIER_INFO[cp.carrier_type]
                rails = set(range(cp.start_rail, cp.start_rail + info["width_rails"]))
                overlap = occupied & rails
                if overlap:
                    struct_errors.append(
                        f"Rail conflict: {cp.carrier_type.value} overlaps rails {sorted(overlap)}"
                    )
                    logger.warning(f"Structural error: Rail conflict at {sorted(overlap)}")
                occupied |= rails
                if cp.start_rail + info["width_rails"] - 1 > deck_model.total_rails:
                    struct_errors.append(
                        f"Carrier at rail {cp.start_rail} extends beyond deck (max {deck_model.total_rails})"
                    )
                    logger.warning(f"Structural error: Carrier extends beyond deck")
            if struct_errors:
                logger.error(f"Structural validation failed with {len(struct_errors)} errors")
                logger.info("=" * 80)
                return ApiResponse.success(
                    data=AgenticValidateResponse(
                        valid=False,
                        feedback="Structural deck errors detected:\n" + "\n".join(f"- {e}" for e in struct_errors),
                    ).model_dump(),
                    message="Validation completed"
                )
            logger.info("Structural validation passed")
        except Exception as e:
            logger.error(f"Error during structural validation: {e}", exc_info=True)

    # Get provider
    try:
        provider = await get_provider(req.llm_config, db, user_id=current_user.id)
        logger.info(f"Provider obtained: {type(provider).__name__}")
    except Exception as e:
        logger.error(f"Failed to get provider: {e}", exc_info=True)
        logger.info("=" * 80)
        return ApiResponse.error(message=f"Failed to get AI provider: {e}", status_code=500)

    # Fetch vector store context if provided
    kb_context = ""
    if req.vector_store_id:
        kb_context = await search_vector_store_context(
            db, current_user, req.vector_store_id, req.goal
        )

    # Build prompt
    try:
        prompt = build_agentic_validate_prompt(
            phase=req.phase,
            goal=req.goal,
            deck_context=deck_ctx,
            procedure_context=req.procedure_context or "",
            knowledge_context=kb_context,
        )
        logger.info(f"Validation prompt built, length: {len(prompt)} characters")
        logger.debug(f"Prompt preview (first 200 chars): {prompt[:200]}...")
    except Exception as e:
        logger.error(f"Failed to build validation prompt: {e}", exc_info=True)
        logger.info("=" * 80)
        return ApiResponse.error(message=f"Failed to build validation prompt: {e}", status_code=500)

    # Build system prompt with labware context
    labware_ctx = _get_labware_system_context(req.deck_config)
    system_prompt_text = get_system_prompt("agentic", labware_context=labware_ctx)

    # Call LLM
    try:
        logger.info("Calling LLM for validation...")
        response = await provider.generate(
            prompt,
            system_prompt=system_prompt_text,
            temperature=0.1,
        )
        text = response.text.strip()
        logger.info(f"LLM response received, length: {len(text)} characters")
        logger.debug(f"LLM response (first 300 chars): {text[:300]}...")
    except Exception as e:
        logger.error(f"LLM generation failed: {e}", exc_info=True)
        logger.info("=" * 80)
        return ApiResponse.error(message=f"LLM generation failed: {e}", status_code=500)

    # Parse response
    try:
        first_line = text.splitlines()[0].strip().upper() if text.splitlines() else ""
        logger.info(f"First line of response: '{first_line}'")

        valid = first_line.startswith("VALID") and not first_line.startswith("INVALID")
        logger.info(f"Validation result: valid={valid}")

        rest = "\n".join(text.splitlines()[1:]).strip()
        logger.info(f"Feedback length: {len(rest)} characters")
        logger.debug(f"Feedback preview (first 200 chars): {rest[:200]}...")

        result = AgenticValidateResponse(valid=valid, feedback=rest or text)
        logger.info(f"Returning response: valid={result.valid}, feedback_length={len(result.feedback)}")
        logger.info("=" * 80)
        return ApiResponse.success(data=result.model_dump(), message="Validation completed")
    except Exception as e:
        logger.error(f"Failed to parse LLM response: {e}", exc_info=True)
        logger.info("=" * 80)
        return ApiResponse.error(message=f"Failed to parse LLM response: {e}", status_code=500)


@router.post("/chat")
async def chat(
    req: AgenticChatRequest,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    logger.info(f"🔧 Agentic chat request - Provider: {req.llm_config.provider}, Model: {req.llm_config.model_name}")
    logger.info(f"🔧 Full LLM config: {req.llm_config.model_dump()}")

    provider = await get_provider(req.llm_config, db, user_id=current_user.id)
    logger.info(f"✅ Provider obtained: {type(provider).__name__}")

    deck_ctx = _deck_context(req.deck_config)
    convo = _conversation_text(req.conversation)
    prompt = build_agentic_chat_prompt(
        phase=req.phase,
        goal=req.goal,
        conversation=convo,
        deck_context=deck_ctx,
        procedure_context=req.procedure_context or "",
        generation_context=req.generation_context or "",
    )

    kb_context = ""
    if req.vector_store_id:
        last_user_msg = next(
            (m.content for m in reversed(req.conversation) if m.role == "user"), ""
        )
        kb_context = await search_vector_store_context(
            db, current_user, req.vector_store_id,
            f"{req.goal} {last_user_msg}".strip(),
        )

    labware_ctx = _get_labware_system_context(req.deck_config)
    system_prompt_text = get_system_prompt("agentic", labware_context=labware_ctx)

    logger.info(f"📝 Sending prompt to {req.llm_config.provider} provider...")
    logger.debug(f"📄 Prompt content: {prompt[:500]}...")  # First 500 chars of prompt

    if kb_context:
        prompt = f"{prompt}\n\n{kb_context}"

    response = await provider.generate(
        prompt,
        system_prompt=system_prompt_text,
        temperature=0.25,
    )

    logger.info(f"✅ Response received from {req.llm_config.provider}")
    logger.info(f"📄 Raw response text: {response.text[:500]}...")  # First 500 chars

    normalized_response = _normalize_ready_response(response.text)

    logger.info(f"🔍 Normalized response structure:")
    logger.info(f"  - ready: {normalized_response.ready}")
    logger.info(f"  - question: {normalized_response.question}")
    logger.info(f"  - summary: {normalized_response.summary}")

    if normalized_response.ready:
        logger.info(f"🎯 Response indicates READY state - should trigger validation")

    return ApiResponse.success(data=normalized_response.model_dump(), message="Chat response generated")


@router.post("/generate")
async def generate(
    req: AgenticGenerationRequest,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    provider = await get_provider(req.llm_config, db, user_id=current_user.id)
    deck_ctx = _deck_context(req.deck_config)

    search_query = f"{req.goal} {req.procedure_context or ''}".strip()
    rag_context = format_rag_context(search_query)
    kb_context = ""
    if req.vector_store_id:
        kb_context = await search_vector_store_context(
            db, current_user, req.vector_store_id, search_query
        )

    combined_rag = "\n\n".join(filter(None, [rag_context, kb_context]))
    prompt = build_agentic_generation_prompt(
        goal=req.goal,
        deck_context=deck_ctx,
        procedure_context=req.procedure_context or "",
        rag_context=combined_rag,
    )
    labware_ctx = _get_labware_system_context(req.deck_config)
    response = await provider.generate(
        prompt,
        system_prompt=get_system_prompt("agentic", labware_context=labware_ctx),
        temperature=0.2,
    )
    blocks = _extract_code_blocks(response.text)
    if len(blocks) < 2:
        return ApiResponse.error(
            message="The model did not return both a script and a test file.",
            status_code=500
        )
    notes = response.text
    result = AgenticGenerationResponse(script=blocks[0], tests=blocks[1], notes=notes)
    return ApiResponse.success(data=result.model_dump(), message="Script generated successfully")


@router.post("/verify")
async def verify(req: AgenticVerificationRequest):
    script_report = run_syntax_check(req.script or "")
    syntax_artifact = VerificationArtifact(
        passed=script_report.passed,
        exit_code=0 if script_report.passed else 1,
        stdout="",
        stderr="\n".join(issue.message for issue in script_report.issues if issue.severity == "error"),
        command="ast.parse",
    )

    interpreter_report = run_python_interpreter(req.script or "")
    pytest_report = run_pytest_suite(req.tests or "")
    passed = bool(syntax_artifact.passed and interpreter_report["passed"] and pytest_report["passed"])
    feedback = _verification_feedback(syntax_artifact.model_dump(), interpreter_report, pytest_report)
    result = AgenticVerificationResponse(
        syntax=syntax_artifact,
        interpreter=VerificationArtifact.model_validate(interpreter_report),
        pytest=VerificationArtifact.model_validate(pytest_report),
        passed=passed,
        feedback=feedback,
    )
    return ApiResponse.success(data=result.model_dump(), message="Verification completed")


@router.post("/fix")
async def fix(
    req: AgenticFixRequest,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    provider = await get_provider(req.llm_config, db, user_id=current_user.id)
    deck_ctx = _deck_context(req.deck_config)
    verification_feedback = getattr(req, "verification_feedback", "")

    kb_context = ""
    if req.vector_store_id:
        fix_query = f"{req.goal} {verification_feedback}".strip()
        kb_context = await search_vector_store_context(
            db, current_user, req.vector_store_id, fix_query
        )

    prompt = build_agentic_fix_prompt(
        goal=req.goal,
        deck_context=deck_ctx,
        procedure_context=req.procedure_context or "",
        script=req.script,
        tests=req.tests,
        verification_feedback=verification_feedback,
        knowledge_context=kb_context,
    )
    labware_ctx = _get_labware_system_context(req.deck_config)
    response = await provider.generate(
        prompt,
        system_prompt=get_system_prompt("agentic", labware_context=labware_ctx),
        temperature=0.2,
    )
    blocks = _extract_code_blocks(response.text)
    if len(blocks) < 2:
        return ApiResponse.error(
            message="The model did not return both a fixed script and fixed tests.",
            status_code=500
        )
    result = AgenticGenerationResponse(script=blocks[0], tests=blocks[1], notes=response.text)
    return ApiResponse.success(data=result.model_dump(), message="Script fixed successfully")


@router.post("/clarify")
async def clarify(
    req: ClarifyRequest,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Legacy single-turn conversation step kept for existing clients."""
    provider = await get_provider(req.llm_config, db, user_id=current_user.id)

    deck_ctx = req.deck_context
    if not deck_ctx and req.deck_config:
        deck_ctx = _deck_context(req.deck_config)

    system_prompt = (
        "You are a Hamilton liquid-handling robot expert helping a scientist clarify their automation protocol. "
        "Your job is to ask exactly ONE targeted clarifying question that will help generate a correct PyHamilton script. "
        "Focus on what's missing: volumes, source/dest labware, number of samples, tip strategy, mix steps, etc. "
        "Once you have enough information (after 2-4 exchanges), respond with exactly: READY\n"
        "Do NOT write any code yet. Do NOT ask multiple questions at once."
    )

    history_text = ""
    for msg in req.conversation:
        role_label = "Scientist" if msg.role == "user" else "Assistant"
        history_text += f"{role_label}: {msg.content}\n"

    deck_ctx_text = f"\n\nDeck configuration:\n{deck_ctx}" if deck_ctx else ""
    prompt = (
        f"Automation goal: {req.goal}{deck_ctx_text}\n\n"
        f"Conversation so far:\n{history_text}\n"
        "What is your next clarifying question, or are you ready? "
        "If ready, respond with exactly: READY"
    )

    response = await provider.generate(prompt, system_prompt=system_prompt, temperature=0.3)
    text = response.text.strip()

    ready = text.upper().startswith("READY")
    return ApiResponse.success(
        data={
            "ready": ready,
            "question": None if ready else text,
            "summary": text if ready else None,
        },
        message="Clarification response generated"
    )


