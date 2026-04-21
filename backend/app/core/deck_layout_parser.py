"""Parser for Hamilton Venus AutomationDeck.json files."""
from __future__ import annotations

import logging
import os
import re
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ─── Code-extraction helpers ──────────────────────────────────────────────────

def _extract_code_from_file(file_path: str) -> str:
    """Extract the bare type code from a Venus labware file path.

    'ML_STAR\\TIP_CAR_480_A00.tml'  →  'TIP_CAR_480_A00'
    'Hamilton\\Ham_96_FluorMeasure_Black.rck'  →  'Ham_96_FluorMeasure_Black'
    """
    basename = os.path.splitext(os.path.basename(file_path.replace("\\", "/")))[0]
    return basename


def _parse_carrier_site_id(site_id: str) -> tuple[int, int] | None:
    """Parse '{width}T-{start_rail}' → (width_rails, start_rail).

    Returns None if the site_id does not match the pattern.
    """
    m = re.match(r"^(\d+)T-(\d+)$", site_id)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def _infer_carrier_category(code: str) -> str:
    code_upper = code.upper()
    if "TIP_CAR" in code_upper:
        return "tip"
    if "PLT_CAR" in code_upper:
        return "plate"
    if "RGT_CAR" in code_upper:
        return "reagent"
    return "unknown"


def _infer_carrier_accepts(category: str) -> list[str]:
    mapping = {
        "tip": ["tip_rack"],
        "plate": ["plate"],
        "reagent": ["reservoir"],
    }
    return mapping.get(category, ["plate"])


def _infer_labware_category(code: str) -> str:
    code_upper = code.upper()
    # Tip racks contain 'HT_' or 'TIP'
    if re.search(r"\bHT_|TIPONE|_TIPS?_", code_upper) or code_upper.startswith("HT_"):
        return "tip_rack"
    if re.search(r"PLT|PLATE|_WELL|96|384|PCR", code_upper):
        return "plate"
    if re.search(r"TROUGH|RGT|RESERVOIR", code_upper):
        return "reservoir"
    # .rck files that are on tip carriers are probably tip racks
    return "plate"


# ─── DB upsert helpers ────────────────────────────────────────────────────────

async def _upsert_carrier_type(
    db: AsyncSession,
    code: str,
    width_rails: int,
    *,
    num_slots: int = 5,
) -> None:
    """Create a CarrierType row if one doesn't exist yet."""
    from app.models.labware import CarrierType  # avoid circular at module level

    result = await db.execute(select(CarrierType).where(CarrierType.code == code))
    existing = result.scalar_one_or_none()
    if existing:
        return

    category = _infer_carrier_category(code)
    carrier = CarrierType(
        code=code,
        name=code.replace("_", " ").title(),
        category=category,
        width_rails=width_rails,
        num_slots=num_slots,
        accepts=_infer_carrier_accepts(category),
        description=f"Imported from AutomationDeck.json",
        is_active=True,
        properties={},
    )
    db.add(carrier)
    logger.info("Created CarrierType: %s", code)


async def _upsert_labware_type(db: AsyncSession, code: str) -> None:
    """Create a LabwareType row if one doesn't exist yet."""
    from app.models.labware import LabwareType

    result = await db.execute(select(LabwareType).where(LabwareType.code == code))
    existing = result.scalar_one_or_none()
    if existing:
        return

    category = _infer_labware_category(code)
    labware = LabwareType(
        code=code,
        name=code.replace("_", " ").title(),
        category=category,
        description=f"Imported from AutomationDeck.json",
        is_active=True,
        properties={},
    )
    db.add(labware)
    logger.info("Created LabwareType: %s", code)


# ─── Main parser ──────────────────────────────────────────────────────────────

async def parse_automation_deck_json(
    data: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    """Parse an AutomationDeck.json payload and return a DeckConfig-compatible dict.

    Also upserts CarrierType and LabwareType rows in the DB for any codes found.
    """
    labware_list: list[dict] = data.get("layout", {}).get("labware", [])

    # ── Step 1: identify carriers (template == "default", file ends in .tml) ──
    carriers_raw: list[dict] = []
    for item in labware_list:
        template = item.get("template", "")
        file_path = item.get("file", "")
        site_id = item.get("site_id", "")
        if template == "default" and file_path.lower().endswith(".tml"):
            parsed = _parse_carrier_site_id(site_id)
            if parsed is None:
                continue  # skip items without a valid deck rail site_id
            width_rails, start_rail = parsed
            carriers_raw.append({
                "id": item["id"],
                "code": _extract_code_from_file(file_path),
                "start_rail": start_rail,
                "width_rails": width_rails,
            })

    # ── Step 2: for each carrier find its child labware ──────────────────────
    carrier_placements: list[dict] = []

    for carrier in carriers_raw:
        carrier_id = carrier["id"]
        carrier_code = carrier["code"]
        start_rail = carrier["start_rail"]
        width_rails = carrier["width_rails"]

        # Upsert carrier type
        await _upsert_carrier_type(db, carrier_code, width_rails)

        # Collect child labware (template == carrier_id, file ends in .rck)
        children: dict[int, dict] = {}
        for item in labware_list:
            if item.get("template") == carrier_id and item.get("file", "").lower().endswith(".rck"):
                try:
                    slot_idx = int(item["site_id"])
                except (ValueError, KeyError):
                    continue
                lw_code = _extract_code_from_file(item["file"])
                children[slot_idx] = {
                    "code": lw_code,
                    "name": lw_code.replace("_", " ").title(),
                }
                await _upsert_labware_type(db, lw_code)

        # Determine number of slots from children (at least max slot index)
        num_slots = max(children.keys(), default=0) if children else 0
        # Common carrier slot counts
        if "480" in carrier_code or "CAR_5" in carrier_code or "L5" in carrier_code:
            num_slots = max(num_slots, 5)
        elif "288" in carrier_code or "CAR_3" in carrier_code:
            num_slots = max(num_slots, 3)
        else:
            num_slots = max(num_slots, 3)

        # Build slot array (1-indexed → 0-indexed list)
        slots: list[Optional[dict]] = [None] * num_slots
        for slot_idx, lw_info in children.items():
            zero_idx = slot_idx - 1
            if 0 <= zero_idx < num_slots:
                lw_category = _infer_labware_category(lw_info["code"])
                labware_type_key = lw_category  # tip_rack | plate | reservoir

                slots[zero_idx] = {
                    "type": labware_type_key,
                    "subtype": lw_info["code"],
                    "name": lw_info["name"],
                }

        carrier_placements.append({
            "carrier_type": carrier_code,
            "start_rail": start_rail,
            "slots": slots,
        })

    # Flush so any new FK targets are visible (no commit yet — caller commits)
    await db.flush()

    deck_config = {
        "carriers": carrier_placements,
        "aspiration_settings": {
            "volume_ul": 100,
            "flow_rate_ul_per_s": 100,
            "mix_cycles": 0,
            "mix_volume_ul": 0,
            "liquid_class": "Water",
            "tip_type": "300uL",
            "pre_wet": False,
            "touch_off": True,
        },
        "total_rails": 54,
    }

    return deck_config
