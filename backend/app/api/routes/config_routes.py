from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter

from app.config import PROVIDER_MODELS, COMMON_LABWARE
from app.core.metrics import load_aggregate_metrics

router = APIRouter(tags=["config"])


@router.get("/api/config/providers")
async def list_providers():
    return {
        "providers": {
            provider: models
            for provider, models in PROVIDER_MODELS.items()
        }
    }


@router.get("/api/config/labware")
async def list_labware():
    return {"labware": COMMON_LABWARE}


@router.get("/api/metrics")
async def get_metrics():
    metrics = load_aggregate_metrics()
    return asdict(metrics)
