from __future__ import annotations

import json
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

from app.config import LOG_DIR


@dataclass
class PipelineRunLog:
    run_id: str = ""
    mode: str = ""
    provider: str = ""
    model: str = ""
    goal: str = ""
    timestamp: float = field(default_factory=time.time)
    duration_seconds: float = 0.0
    total_retries: int = 0
    syntax_errors: int = 0
    hallucinations: int = 0
    final_success: bool = False
    first_pass_success: bool = False
    comparison_score: float = 0.0

    def save(self) -> Path:
        filepath = LOG_DIR / f"{self.run_id}.json"
        filepath.write_text(json.dumps(asdict(self), indent=2))
        return filepath


@dataclass
class AggregateMetrics:
    total_runs: int = 0
    first_pass_rate: float = 0.0
    final_success_rate: float = 0.0
    avg_retries: float = 0.0
    syntax_error_rate: float = 0.0
    hallucination_rate: float = 0.0
    avg_comparison_score: float = 0.0
    avg_duration_seconds: float = 0.0


def load_aggregate_metrics() -> AggregateMetrics:
    log_files = list(LOG_DIR.glob("*.json"))
    if not log_files:
        return AggregateMetrics()

    logs: list[PipelineRunLog] = []
    for f in log_files:
        try:
            data = json.loads(f.read_text())
            logs.append(PipelineRunLog(**data))
        except (json.JSONDecodeError, TypeError):
            continue

    n = len(logs)
    if n == 0:
        return AggregateMetrics()

    return AggregateMetrics(
        total_runs=n,
        first_pass_rate=sum(1 for l in logs if l.first_pass_success) / n,
        final_success_rate=sum(1 for l in logs if l.final_success) / n,
        avg_retries=sum(l.total_retries for l in logs) / n,
        syntax_error_rate=sum(1 for l in logs if l.syntax_errors > 0) / n,
        hallucination_rate=sum(1 for l in logs if l.hallucinations > 0) / n,
        avg_comparison_score=sum(l.comparison_score for l in logs) / n,
        avg_duration_seconds=sum(l.duration_seconds for l in logs) / n,
    )
