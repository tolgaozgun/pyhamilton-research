from __future__ import annotations

import os
from enum import Enum
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


class Mode(str, Enum):
    SIMPLE = "simple"
    DEVELOPER = "developer"
    AGENTIC = "agentic"


class Provider(str, Enum):
    GOOGLE = "google"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    OPENROUTER = "openrouter"


class PipelineStep(str, Enum):
    FEASIBILITY = "feasibility"
    LABWARE_MAP = "labware_map"
    CODE_GENERATION = "code_generation"
    SYNTAX_CHECK = "syntax_check"
    SIMULATION = "simulation"
    OUTCOME_COMPARISON = "outcome_comparison"
    FIX = "fix"
    RESULTS = "results"


PROVIDER_MODELS: dict[str, list[str]] = {
    Provider.GOOGLE: [
        "gemini-2.0-flash",
        "gemini-2.0-pro",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ],
    Provider.OPENAI: [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "o1-preview",
    ],
    Provider.ANTHROPIC: [
        "claude-sonnet-4-20250514",
        "claude-3-5-sonnet-20241022",
        "claude-3-haiku-20240307",
    ],
    Provider.OPENROUTER: [
        "openai/gpt-4o",
        "anthropic/claude-sonnet-4-20250514",
        "google/gemini-2.0-flash-001",
        "meta-llama/llama-3.1-405b-instruct",
    ],
}

PYHAMILTON_KNOWN_APIS: set[str] = {
    "initialize",
    "stop",
    "resource_list_with_print",
    "tip_pick_up",
    "tip_eject",
    "aspirate",
    "dispense",
    "tip_pick_up_96",
    "tip_eject_96",
    "aspirate_96",
    "dispense_96",
    "grip_get",
    "grip_place",
    "grip_move",
    "move_sequence",
    "assign_labware",
    "edit_sequence",
    "get_sequence_length",
    "set_tip_tracking",
    "set_deck_layout",
    "load_labware",
    "LayoutManager",
    "HamiltonInterface",
    "INITIALIZE",
    "PICKUP",
    "EJECT",
    "ASPIRATE",
    "DISPENSE",
    "PICKUP96",
    "EJECT96",
    "ASPIRATE96",
    "DISPENSE96",
    "GRIP_GET",
    "GRIP_PLACE",
}

VOLUME_BOUNDS = {
    "min_aspirate_ul": 0.5,
    "max_aspirate_ul": 1000.0,
    "min_dispense_ul": 0.5,
    "max_dispense_ul": 1000.0,
}

COMMON_LABWARE: list[dict[str, str]] = [
    {"id": "tip_rack_300", "name": "300µL Tip Rack", "type": "tips"},
    {"id": "tip_rack_1000", "name": "1000µL Tip Rack", "type": "tips"},
    {"id": "tip_rack_50", "name": "50µL Tip Rack", "type": "tips"},
    {"id": "plate_96_well", "name": "96-Well Plate", "type": "plate"},
    {"id": "plate_384_well", "name": "384-Well Plate", "type": "plate"},
    {"id": "reservoir_300ml", "name": "300mL Reservoir", "type": "reservoir"},
    {"id": "tube_rack_15ml", "name": "15mL Tube Rack", "type": "tube_rack"},
    {"id": "tube_rack_50ml", "name": "50mL Tube Rack", "type": "tube_rack"},
    {"id": "deep_well_plate", "name": "96 Deep Well Plate", "type": "plate"},
    {"id": "pcr_plate", "name": "PCR Plate", "type": "plate"},
]

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BASE_DIR / "logs"
RAG_DIR = BASE_DIR / "rag_data"

LOG_DIR.mkdir(parents=True, exist_ok=True)
RAG_DIR.mkdir(parents=True, exist_ok=True)


class LLMConfig(BaseModel):
    provider: Provider = Provider.GOOGLE
    model_name: str = "gemini-2.0-flash"
    api_key: Optional[str] = None
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4096, ge=1)

    @model_validator(mode="after")
    def _validate_model_for_provider(self) -> "LLMConfig":
        available = PROVIDER_MODELS.get(self.provider, [])
        if available and self.model_name not in available:
            self.model_name = available[0]
        return self


class UserInput(BaseModel):
    goal: str
    mode: Mode = Mode.SIMPLE
    context: Optional[str] = None
    image_b64: Optional[str] = None
    max_retries: int = Field(default=3, ge=1, le=10)


class LabwareMap(BaseModel):
    positions: dict[str, str] = Field(default_factory=dict)
    tips: list[str] = Field(default_factory=list)
    plates: list[str] = Field(default_factory=list)
    reservoirs: list[str] = Field(default_factory=list)
    raw_text: str = ""


class SimulationResult(BaseModel):
    success: bool = False
    tip_usage: dict[str, int] = Field(default_factory=dict)
    volumes_moved: dict[str, float] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    operations_log: list[str] = Field(default_factory=list)


class ComparisonResult(BaseModel):
    match: bool = False
    tier: str = "programmatic"
    score: float = 0.0
    explanation: str = ""
    diffs: list[str] = Field(default_factory=list)


class PipelineState(BaseModel):
    step: PipelineStep = PipelineStep.FEASIBILITY
    user_input: UserInput
    llm_config: LLMConfig = Field(default_factory=LLMConfig)
    feasibility: Optional[str] = None
    labware_map: Optional[LabwareMap] = None
    generated_code: Optional[str] = None
    syntax_ok: bool = False
    syntax_errors: list[str] = Field(default_factory=list)
    simulation: Optional[SimulationResult] = None
    comparison: Optional[ComparisonResult] = None
    final_script: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    events: list[dict[str, Any]] = Field(default_factory=list)
    error: Optional[str] = None
