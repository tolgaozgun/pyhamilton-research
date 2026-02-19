"""Quality metrics per Updated PRD v2 section 8."""

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

from config import LOG_DIR


@dataclass
class PipelineRunLog:
    """Full log of a single pipeline run."""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    mode: str = ""
    model: str = ""
    input_prompt: str = ""
    generated_code: Optional[str] = None
    feasibility_result: Optional[dict] = None
    labware_map: Optional[dict] = None
    syntax_check_passed: bool = False
    syntax_errors: list[str] = field(default_factory=list)
    simulation_passed: bool = False
    simulation_logs: str = ""
    comparison_result: Optional[dict] = None
    final_passed: bool = False
    retry_count: int = 0
    retry_history: list[dict] = field(default_factory=list)
    error_category: Optional[str] = None
    api_hallucinations: int = 0

    def save(self):
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        ts = self.timestamp.replace(":", "-").replace(".", "-")
        path = LOG_DIR / f"run_{ts}.json"
        path.write_text(json.dumps(self.to_dict(), indent=2))

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "mode": self.mode,
            "model": self.model,
            "input_prompt": self.input_prompt[:500],
            "has_generated_code": self.generated_code is not None,
            "feasibility_result": self.feasibility_result,
            "labware_map": self.labware_map,
            "syntax_check_passed": self.syntax_check_passed,
            "syntax_errors": self.syntax_errors,
            "simulation_passed": self.simulation_passed,
            "comparison_result": self.comparison_result,
            "final_passed": self.final_passed,
            "retry_count": self.retry_count,
            "retry_history": self.retry_history,
            "error_category": self.error_category,
            "api_hallucinations": self.api_hallucinations,
        }


@dataclass
class AggregateMetrics:
    """Rolling metrics across pipeline runs."""
    total_runs: int = 0
    first_pass_successes: int = 0
    final_successes: int = 0
    total_retries: int = 0
    total_syntax_errors: int = 0
    total_hallucinations: int = 0
    error_categories: dict = field(default_factory=dict)

    @property
    def first_pass_rate(self) -> float:
        return (self.first_pass_successes / self.total_runs * 100) if self.total_runs else 0

    @property
    def final_success_rate(self) -> float:
        return (self.final_successes / self.total_runs * 100) if self.total_runs else 0

    @property
    def avg_retries(self) -> float:
        return (self.total_retries / self.final_successes) if self.final_successes else 0

    @property
    def syntax_error_rate(self) -> float:
        return (self.total_syntax_errors / self.total_runs * 100) if self.total_runs else 0

    @property
    def hallucination_rate(self) -> float:
        return (self.total_hallucinations / self.total_runs * 100) if self.total_runs else 0

    def to_display(self) -> dict:
        return {
            "Total Runs": self.total_runs,
            "First-Pass Rate": f"{self.first_pass_rate:.0f}%",
            "Final Success Rate": f"{self.final_success_rate:.0f}%",
            "Avg Retries": f"{self.avg_retries:.1f}",
            "Syntax Error Rate": f"{self.syntax_error_rate:.0f}%",
            "Hallucination Rate": f"{self.hallucination_rate:.0f}%",
        }


def load_aggregate_metrics() -> AggregateMetrics:
    """Compute aggregate metrics from saved run logs."""
    metrics = AggregateMetrics()
    log_dir = LOG_DIR

    if not log_dir.exists():
        return metrics

    for path in sorted(log_dir.glob("run_*.json")):
        try:
            data = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            continue

        metrics.total_runs += 1
        retries = data.get("retry_count", 0)

        if data.get("final_passed"):
            metrics.final_successes += 1
            if retries == 0:
                metrics.first_pass_successes += 1
            metrics.total_retries += retries

        if data.get("syntax_errors"):
            metrics.total_syntax_errors += 1

        metrics.total_hallucinations += data.get("api_hallucinations", 0)

        cat = data.get("error_category")
        if cat:
            metrics.error_categories[cat] = metrics.error_categories.get(cat, 0) + 1

    return metrics
