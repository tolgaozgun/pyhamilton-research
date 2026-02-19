from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.config import SimulationResult, ComparisonResult
from app.core.safety import run_syntax_check
from app.core.simulator import get_simulator
from app.core.comparison import programmatic_compare


@dataclass
class ToolResult:
    success: bool
    data: dict[str, Any]
    message: str = ""


def validate_script(code: str) -> ToolResult:
    report = run_syntax_check(code)
    return ToolResult(
        success=report.passed,
        data={
            "passed": report.passed,
            "issues": [
                {"severity": i.severity, "message": i.message, "line": i.line}
                for i in report.issues
            ],
        },
        message="Validation passed" if report.passed else f"{len(report.issues)} issue(s) found",
    )


def simulate_run(code: str, goal: str) -> ToolResult:
    simulator = get_simulator("mock")
    result = simulator.simulate(code, goal)
    return ToolResult(
        success=result.success,
        data=result.model_dump(),
        message="Simulation complete" if result.success else "Simulation found issues",
    )


def compare_outcome_tool(
    sim_result: SimulationResult,
    expected_volumes: dict[str, float] | None = None,
) -> ToolResult:
    result = programmatic_compare(sim_result, expected_volumes)
    return ToolResult(
        success=result.match,
        data=result.model_dump(),
        message=result.explanation,
    )
