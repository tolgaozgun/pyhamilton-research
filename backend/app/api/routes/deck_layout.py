"""CRUD routes for user-saved deck layouts, plus JSON import."""
from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps_auth import get_current_active_user
from app.core.deck_layout_parser import parse_automation_deck_json
from app.core.responses import ApiResponse
from app.database import get_db, DbSession
from app.models.deck_layout import UserDeckLayout
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/deck-layouts", tags=["deck_layouts"])


# ─── Request / Response models ────────────────────────────────────────────────

class CreateDeckLayoutRequest(BaseModel):
    name: str
    description: Optional[str] = None
    configuration: dict  # full DeckConfig


class UpdateDeckLayoutRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    configuration: Optional[dict] = None
    validation_status: Optional[str] = None
    validation_feedback: Optional[str] = None


class ImportDeckLayoutRequest(BaseModel):
    name: str
    description: Optional[str] = None


# ─── List ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_deck_layouts(
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(UserDeckLayout)
        .where(UserDeckLayout.user_id == user.id)
        .order_by(UserDeckLayout.created_at.desc())
    )
    layouts = result.scalars().all()
    return ApiResponse.success(data=[l.to_dict() for l in layouts])


# ─── Create ───────────────────────────────────────────────────────────────────

@router.post("")
async def create_deck_layout(
    req: CreateDeckLayoutRequest,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    layout = UserDeckLayout(
        user_id=user.id,
        name=req.name,
        description=req.description,
        configuration=req.configuration,
        source="manual",
    )
    db.add(layout)
    await db.flush()
    return ApiResponse.success(data=layout.to_dict(), message="Deck layout created")


# ─── Get one ──────────────────────────────────────────────────────────────────

@router.get("/{layout_id}")
async def get_deck_layout(
    layout_id: int,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    layout = await _get_owned(layout_id, user, db)
    return ApiResponse.success(data=layout.to_dict())


# ─── Update ───────────────────────────────────────────────────────────────────

@router.put("/{layout_id}")
async def update_deck_layout(
    layout_id: int,
    req: UpdateDeckLayoutRequest,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    layout = await _get_owned(layout_id, user, db)
    if req.name is not None:
        layout.name = req.name
    if req.description is not None:
        layout.description = req.description
    if req.configuration is not None:
        layout.configuration = req.configuration
        layout.validation_status = "unvalidated"
        layout.validation_feedback = None
    if req.validation_status is not None:
        layout.validation_status = req.validation_status
    if req.validation_feedback is not None:
        layout.validation_feedback = req.validation_feedback
    await db.flush()
    return ApiResponse.success(data=layout.to_dict(), message="Deck layout updated")


# ─── Delete ───────────────────────────────────────────────────────────────────

@router.delete("/{layout_id}")
async def delete_deck_layout(
    layout_id: int,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    layout = await _get_owned(layout_id, user, db)
    await db.delete(layout)
    return ApiResponse.success(message="Deck layout deleted")


# ─── Import from JSON ─────────────────────────────────────────────────────────

@router.post("/import/json")
async def import_deck_layout_json(
    name: str,
    description: Optional[str] = None,
    file: UploadFile = File(...),
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Upload an AutomationDeck.json file and parse it into a saved deck layout.

    New CarrierType and LabwareType DB rows are created automatically for any
    codes found in the file that do not already exist.
    """
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="File must be a .json file")

    raw = await file.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc

    try:
        deck_config = await parse_automation_deck_json(data, db)
    except Exception as exc:
        logger.exception("Failed to parse AutomationDeck.json")
        raise HTTPException(status_code=422, detail=f"Could not parse deck layout: {exc}") from exc

    layout = UserDeckLayout(
        user_id=user.id,
        name=name,
        description=description,
        configuration=deck_config,
        source="imported",
        source_filename=file.filename,
    )
    db.add(layout)
    await db.flush()

    carriers_count = len(deck_config.get("carriers", []))
    return ApiResponse.success(
        data=layout.to_dict(),
        message=f"Imported {carriers_count} carrier(s) from {file.filename}",
    )


# ─── Validate (structural) ────────────────────────────────────────────────────

@router.post("/{layout_id}/validate")
async def validate_deck_layout(
    layout_id: int,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Run structural validation on the saved deck layout."""
    layout = await _get_owned(layout_id, user, db)
    config = layout.configuration or {}
    carriers = config.get("carriers", [])
    total_rails = config.get("total_rails", 54)

    errors: list[str] = []
    occupied: set[int] = set()

    for cp in carriers:
        carrier_type = cp.get("carrier_type", "?")
        start_rail = cp.get("start_rail", 0)
        # Try to infer width_rails from code or fall back to 6
        width_rails = _infer_width(carrier_type)
        carrier_rails = set(range(start_rail, start_rail + width_rails))
        overlap = occupied & carrier_rails
        if overlap:
            errors.append(
                f"Rail conflict: {carrier_type} at rail {start_rail} overlaps rails {sorted(overlap)}"
            )
        occupied |= carrier_rails
        if start_rail + width_rails - 1 > total_rails:
            errors.append(
                f"Carrier {carrier_type} at rail {start_rail} extends beyond deck (max {total_rails})"
            )

    if not carriers:
        errors.append("No carriers configured on this deck layout.")

    status = "valid" if not errors else "invalid"
    feedback = "\n".join(errors) if errors else "Deck layout is structurally valid."

    layout.validation_status = status
    layout.validation_feedback = feedback
    await db.flush()

    return ApiResponse.success(
        data={"valid": status == "valid", "errors": errors, "feedback": feedback}
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _infer_width(carrier_code: str) -> int:
    code = carrier_code.upper()
    if "2T" in code:
        return 2
    if "3T" in code:
        return 3
    if "4T" in code:
        return 4
    return 6  # most Hamilton carriers are 6 rails wide


async def _get_owned(layout_id: int, user: User, db: DbSession) -> UserDeckLayout:
    result = await db.execute(
        select(UserDeckLayout).where(
            UserDeckLayout.id == layout_id,
            UserDeckLayout.user_id == user.id,
        )
    )
    layout = result.scalar_one_or_none()
    if layout is None:
        raise HTTPException(status_code=404, detail="Deck layout not found")
    return layout
