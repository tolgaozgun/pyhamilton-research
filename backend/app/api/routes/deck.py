from __future__ import annotations
from fastapi import APIRouter
from app.deck import (
    CARRIER_INFO, TIP_TYPE_INFO, PLATE_TYPE_INFO, RESERVOIR_TYPE_INFO,
    DeckConfiguration, CarrierType, get_default_deck,
)

router = APIRouter(prefix="/api/deck", tags=["deck"])


@router.get("/carriers")
async def list_carriers():
    return {
        carrier_type.value: info
        for carrier_type, info in CARRIER_INFO.items()
    }


@router.get("/labware")
async def list_labware():
    return {
        "tips": {k.value: v for k, v in TIP_TYPE_INFO.items()},
        "plates": {k.value: v for k, v in PLATE_TYPE_INFO.items()},
        "reservoirs": {k.value: v for k, v in RESERVOIR_TYPE_INFO.items()},
    }


@router.get("/default")
async def get_default():
    return get_default_deck().model_dump()


@router.post("/validate")
async def validate_deck(deck: DeckConfiguration):
    errors = []
    occupied_rails = set()
    for cp in deck.carriers:
        info = CARRIER_INFO[cp.carrier_type]
        carrier_rails = set(range(cp.start_rail, cp.start_rail + info["width_rails"]))
        overlap = occupied_rails & carrier_rails
        if overlap:
            errors.append(f"Rail conflict: {cp.carrier_type.value} at rail {cp.start_rail} overlaps rails {overlap}")
        occupied_rails |= carrier_rails
        if cp.start_rail + info["width_rails"] - 1 > deck.total_rails:
            errors.append(f"Carrier at rail {cp.start_rail} extends beyond deck (max {deck.total_rails})")
    return {"valid": len(errors) == 0, "errors": errors}
