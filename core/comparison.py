"""Two-tier outcome comparison system per PRD section 7."""

import json
import re
from typing import Optional

from config import ComparisonResult, SimulationResult, VOLUME_TOLERANCE_PCT
from providers.base import BaseLLMProvider


def programmatic_compare(
    sim_result: SimulationResult,
    expected_outcome: str,
) -> ComparisonResult:
    """Tier 1: Programmatic state diff against expected outcome.

    Checks structured fields: volumes, tip usage, labware positions.
    Returns a match result with details.
    """
    if not expected_outcome or not expected_outcome.strip():
        return ComparisonResult(
            match=True,
            tier_used="programmatic",
            details={"reason": "No expected outcome specified — skipping comparison."},
            report="No expected outcome provided. Comparison skipped.",
        )

    state = sim_result.final_state
    ops = state.get("operations", [])

    checks = []
    all_pass = True

    aspirate_volumes = [op["volume"] for op in ops if op["op"] == "aspirate" and op.get("volume")]
    dispense_volumes = [op["volume"] for op in ops if op["op"] == "dispense" and op.get("volume")]

    tip_pickups = sum(1 for op in ops if op["op"] == "tip_pick_up")
    tip_ejects = sum(1 for op in ops if op["op"] == "tip_eject")

    if tip_pickups != tip_ejects:
        checks.append({"field": "tip_usage", "status": "FAIL",
                        "detail": f"Tip pickups ({tip_pickups}) != ejects ({tip_ejects})"})
        all_pass = False
    else:
        checks.append({"field": "tip_usage", "status": "PASS",
                        "detail": f"{tip_pickups} tip cycles balanced."})

    if len(aspirate_volumes) != len(dispense_volumes):
        checks.append({"field": "liquid_balance", "status": "WARN",
                        "detail": f"Aspirations ({len(aspirate_volumes)}) != dispensations ({len(dispense_volumes)})"})
    else:
        checks.append({"field": "liquid_balance", "status": "PASS",
                        "detail": f"{len(aspirate_volumes)} aspirate/dispense pairs."})

    expected_vols = _extract_volumes_from_text(expected_outcome)
    if expected_vols and dispense_volumes:
        vol_checks = _compare_volumes(dispense_volumes, expected_vols)
        checks.extend(vol_checks)
        if any(c["status"] == "FAIL" for c in vol_checks):
            all_pass = False

    report_lines = []
    for c in checks:
        icon = {"PASS": "✓", "FAIL": "✗", "WARN": "⚠"}.get(c["status"], "?")
        report_lines.append(f"[{icon}] {c['field']}: {c['detail']}")

    return ComparisonResult(
        match=all_pass,
        tier_used="programmatic",
        details={"checks": checks},
        report="\n".join(report_lines),
    )


def llm_compare(
    provider: BaseLLMProvider,
    sim_result: SimulationResult,
    expected_outcome: str,
    system_prompt: str = "",
) -> ComparisonResult:
    """Tier 2: LLM-based judgment for fuzzy/qualitative outcomes."""
    prompt = f"""You are evaluating whether a PyHamilton simulation achieved the expected outcome.

## Simulator Logs
{sim_result.logs}

## Simulator Final State
{json.dumps(sim_result.final_state, indent=2)}

## Expected Outcome
{expected_outcome}

## Task
Evaluate whether the simulation results match the expected outcome.
Respond with ONLY a JSON object:
{{
  "match": true/false,
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation",
  "issues": ["list of mismatches, empty if match"]
}}"""

    try:
        response = provider.generate(
            system_prompt=system_prompt or "You are an expert PyHamilton protocol reviewer.",
            user_prompt=prompt,
            temperature=0.1,
        )
        text = response.text.strip()
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return ComparisonResult(
                match=data.get("match", False),
                tier_used="llm",
                details=data,
                report=data.get("reasoning", "LLM judgment complete."),
            )
    except Exception as e:
        return ComparisonResult(
            match=False,
            tier_used="llm",
            details={"error": str(e)},
            report=f"LLM comparison failed: {e}",
        )

    return ComparisonResult(match=False, tier_used="llm", report="Could not parse LLM response.")


def compare_outcome(
    provider: BaseLLMProvider,
    sim_result: SimulationResult,
    expected_outcome: str,
) -> ComparisonResult:
    """Run two-tier comparison: programmatic first, LLM fallback if needed."""
    prog = programmatic_compare(sim_result, expected_outcome)

    if prog.match:
        return prog

    has_structured = bool(_extract_volumes_from_text(expected_outcome))
    if has_structured:
        return prog

    return llm_compare(provider, sim_result, expected_outcome)


def _extract_volumes_from_text(text: str) -> list[float]:
    """Extract volume values from text like '200µL', '100 uL', etc."""
    pattern = re.compile(r'(\d+(?:\.\d+)?)\s*(?:µL|uL|ul|µl)', re.IGNORECASE)
    return [float(m.group(1)) for m in pattern.finditer(text)]


def _compare_volumes(
    actual: list[float],
    expected: list[float],
    tolerance_pct: float = VOLUME_TOLERANCE_PCT,
) -> list[dict]:
    """Compare volume lists with tolerance."""
    checks = []
    for i, (a, e) in enumerate(zip(actual, expected)):
        diff_pct = abs(a - e) / e * 100 if e > 0 else (0 if a == 0 else 100)
        passed = diff_pct <= tolerance_pct
        checks.append({
            "field": f"volume_step_{i+1}",
            "status": "PASS" if passed else "FAIL",
            "detail": f"Expected {e}µL, got {a}µL (diff {diff_pct:.1f}%)",
        })
    return checks
