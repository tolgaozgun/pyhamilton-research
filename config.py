from enum import Enum
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path
import os


class Mode(str, Enum):
    SIMPLE = "simple"
    DEVELOPER = "developer"
    AGENTIC = "agentic"


class Provider(str, Enum):
    GOOGLE = "google"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    OPENROUTER = "openrouter"


PROVIDER_DISPLAY_NAMES = {
    Provider.GOOGLE: "Google Gemini",
    Provider.OPENAI: "OpenAI",
    Provider.ANTHROPIC: "Anthropic",
    Provider.OPENROUTER: "OpenRouter",
}

PROVIDER_MODELS = {
    Provider.GOOGLE: [
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
    ],
    Provider.OPENAI: [
        "gpt-4o",
        "gpt-4-turbo",
        "gpt-4o-mini",
    ],
    Provider.ANTHROPIC: [
        "claude-sonnet-4-20250514",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
    ],
    Provider.OPENROUTER: [],
}

MODE_DISPLAY_NAMES = {
    Mode.SIMPLE: "Simple",
    Mode.DEVELOPER: "Developer",
    Mode.AGENTIC: "Agentic",
}

MODE_DESCRIPTIONS = {
    Mode.SIMPLE: "Prompt in, file out. No validation, no friction. For bench scientists.",
    Mode.DEVELOPER: "Step-by-step validated pipeline with review checkpoints. For automation engineers.",
    Mode.AGENTIC: "Autonomous pipeline with error correction and retry. For power users.",
}

MODE_ICONS = {
    Mode.SIMPLE: "bolt",
    Mode.DEVELOPER: "build",
    Mode.AGENTIC: "smart_toy",
}

COMMON_LABWARE = [
    "96-Well Plate (Corning)",
    "384-Well Plate (Corning)",
    "96 Tip Rack (300µL)",
    "96 Tip Rack (1000µL)",
    "384 Tip Rack",
    "12-Column Trough",
    "1-Well Reservoir",
]

PYHAMILTON_KNOWN_APIS = {
    "HamiltonInterface",
    "LayoutManager",
    "Plate96",
    "Plate384",
    "Tip96",
    "Tip384",
    "Reservoir",
    "initialize",
    "resource_list_with_prefix",
    "normal_logging",
    "aspirate",
    "dispense",
    "tip_pick_up",
    "tip_eject",
    "move_sequence",
    "grip_get",
    "grip_place",
    "aspirate96",
    "dispense96",
    "tip_pick_up_96",
    "tip_eject_96",
}

VOLUME_BOUNDS = {"min_ul": 0.5, "max_ul": 1000.0}
VOLUME_TOLERANCE_PCT = 5.0

PROJECT_ROOT = Path(__file__).parent
LOG_DIR = PROJECT_ROOT / "logs"
RAG_DIR = PROJECT_ROOT / "rag_data"


class PipelineStep(str, Enum):
    INPUT = "input"
    FEASIBILITY = "feasibility"
    LABWARE_MAP = "labware_map"
    CODE_GENERATION = "code_generation"
    SYNTAX_CHECK = "syntax_check"
    SIMULATION = "simulation"
    OUTCOME_COMPARISON = "outcome_comparison"
    RESULTS = "results"


PIPELINE_STEP_LABELS = {
    PipelineStep.INPUT: "User Input",
    PipelineStep.FEASIBILITY: "Feasibility Check",
    PipelineStep.LABWARE_MAP: "Labware Map",
    PipelineStep.CODE_GENERATION: "Code Generation",
    PipelineStep.SYNTAX_CHECK: "Syntax Check",
    PipelineStep.SIMULATION: "Simulation",
    PipelineStep.OUTCOME_COMPARISON: "Outcome Comparison",
    PipelineStep.RESULTS: "Results",
}


@dataclass
class LLMConfig:
    provider: Provider = Provider.GOOGLE
    api_key: str = ""
    model_name: str = "gemini-2.5-flash"
    temperature: float = 0.2
    max_tokens: int = 4096

    @classmethod
    def from_yaml(cls, path: str) -> "LLMConfig":
        import yaml
        with open(path) as f:
            data = yaml.safe_load(f)
        api_key = data.get("api_key", "")
        if api_key.startswith("${") and api_key.endswith("}"):
            env_var = api_key[2:-1]
            api_key = os.environ.get(env_var, "")
        return cls(
            provider=Provider(data.get("provider", "google")),
            api_key=api_key,
            model_name=data.get("model", "gemini-2.5-flash"),
            temperature=data.get("temperature", 0.2),
            max_tokens=data.get("max_tokens", 4096),
        )


@dataclass
class UserInput:
    procedure: str = ""
    labware_locations: Optional[str] = None
    expected_outcome: Optional[str] = None
    image_path: Optional[str] = None


@dataclass
class LabwareMap:
    items: list[dict] = field(default_factory=list)
    deck_positions: dict = field(default_factory=dict)
    expected_outcome: str = ""
    raw_text: str = ""


@dataclass
class SimulationResult:
    success: bool = False
    logs: str = ""
    final_state: dict = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class ComparisonResult:
    match: bool = False
    tier_used: str = "programmatic"
    details: dict = field(default_factory=dict)
    report: str = ""


@dataclass
class PipelineState:
    """Tracks the state of a Developer/Agentic pipeline run."""
    current_step: PipelineStep = PipelineStep.INPUT
    user_input: UserInput = field(default_factory=UserInput)
    llm_config: LLMConfig = field(default_factory=LLMConfig)
    feasibility_result: Optional[str] = None
    feasibility_passed: bool = False
    labware_map: Optional[LabwareMap] = None
    generated_script: Optional[str] = None
    syntax_passed: bool = False
    syntax_errors: list[str] = field(default_factory=list)
    simulation: Optional[SimulationResult] = None
    comparison: Optional[ComparisonResult] = None
    final_passed: bool = False
    retry_count: int = 0
    max_retries: int = 3
    error_history: list[dict] = field(default_factory=list)
