"""Agent tools per Updated PRD v2 section 5 (Agentic Mode)."""

from dataclasses import dataclass

from config import Mode, SimulationResult
from core.safety import run_syntax_check
from core.simulator import get_simulator
from core.comparison import compare_outcome as _compare
from providers.base import BaseLLMProvider


@dataclass
class ToolResult:
    success: bool
    data: dict
    message: str


def validate_script(script: str) -> ToolResult:
    """Run syntax check via Python parser."""
    report = run_syntax_check(script)
    return ToolResult(
        success=report.passed,
        data={
            "passed": report.passed,
            "errors": report.error_count,
            "warnings": report.warning_count,
            "issues": [
                {"message": i.message, "severity": i.severity.value, "line": i.line}
                for i in report.issues
            ],
        },
        message="Syntax check passed." if report.passed else f"Syntax check failed with {report.error_count} error(s).",
    )


def simulate_run(script: str) -> ToolResult:
    """Execute script in simulator."""
    simulator = get_simulator()
    result = simulator.run(script)
    return ToolResult(
        success=result.success,
        data={
            "success": result.success,
            "logs": result.logs,
            "final_state": result.final_state,
            "error": result.error,
        },
        message="Simulation passed." if result.success else f"Simulation failed: {result.error}",
    )


def compare_outcome_tool(
    provider: BaseLLMProvider,
    sim_result: SimulationResult,
    expected_outcome: str,
) -> ToolResult:
    """Compare simulation state against expected outcome."""
    result = _compare(provider, sim_result, expected_outcome)
    return ToolResult(
        success=result.match,
        data={
            "match": result.match,
            "tier_used": result.tier_used,
            "details": result.details,
            "report": result.report,
        },
        message="Outcome matches." if result.match else f"Outcome mismatch: {result.report}",
    )
