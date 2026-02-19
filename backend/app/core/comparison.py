from __future__ import annotations

from typing import Optional, TYPE_CHECKING

from app.config import ComparisonResult, SimulationResult

if TYPE_CHECKING:
    from app.providers.base import BaseLLMProvider


def programmatic_compare(
    sim_result: SimulationResult,
    expected_volumes: Optional[dict[str, float]] = None,
    tolerance: float = 0.05,
) -> ComparisonResult:
    diffs: list[str] = []
    score = 1.0

    if not sim_result.success:
        return ComparisonResult(
            match=False,
            tier="programmatic",
            score=0.0,
            explanation="Simulation failed",
            diffs=sim_result.errors,
        )

    tips = sim_result.tip_usage
    if tips.get("picked", 0) != tips.get("ejected", 0):
        diffs.append(
            f"Tip mismatch: picked={tips.get('picked', 0)}, ejected={tips.get('ejected', 0)}"
        )
        score -= 0.2

    vols = sim_result.volumes_moved
    aspirated = vols.get("aspirated", 0.0)
    dispensed = vols.get("dispensed", 0.0)
    if aspirated > 0:
        balance_ratio = abs(aspirated - dispensed) / aspirated
        if balance_ratio > tolerance:
            diffs.append(
                f"Volume imbalance: aspirated={aspirated}µL, dispensed={dispensed}µL "
                f"(ratio={balance_ratio:.2%})"
            )
            score -= 0.3

    if expected_volumes:
        for key, expected in expected_volumes.items():
            actual = vols.get(key, 0.0)
            if expected > 0 and abs(actual - expected) / expected > tolerance:
                diffs.append(f"Volume '{key}': expected={expected}µL, actual={actual}µL")
                score -= 0.2

    score = max(score, 0.0)
    return ComparisonResult(
        match=len(diffs) == 0,
        tier="programmatic",
        score=score,
        explanation="All checks passed" if not diffs else "; ".join(diffs),
        diffs=diffs,
    )


async def llm_compare(
    provider: "BaseLLMProvider",
    goal: str,
    code: str,
    sim_result: SimulationResult,
) -> ComparisonResult:
    prompt = (
        f"You are evaluating whether a PyHamilton script achieves the user's goal.\n\n"
        f"## Goal\n{goal}\n\n"
        f"## Generated Code\n```python\n{code}\n```\n\n"
        f"## Simulation Results\n"
        f"- Success: {sim_result.success}\n"
        f"- Tip usage: {sim_result.tip_usage}\n"
        f"- Volumes moved: {sim_result.volumes_moved}\n"
        f"- Warnings: {sim_result.warnings}\n"
        f"- Operations: {sim_result.operations_log}\n\n"
        f"Rate the script from 0.0 to 1.0 on how well it achieves the goal. "
        f"Respond ONLY with a JSON object: "
        f'{{\"score\": <float>, \"match\": <bool>, \"explanation\": \"<reason>\"}}'
    )

    response = await provider.generate(prompt)
    try:
        import json
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        data = json.loads(text)
        return ComparisonResult(
            match=data.get("match", False),
            tier="llm",
            score=float(data.get("score", 0.0)),
            explanation=data.get("explanation", ""),
        )
    except (json.JSONDecodeError, KeyError, ValueError):
        return ComparisonResult(
            match=False,
            tier="llm",
            score=0.0,
            explanation=f"Failed to parse LLM comparison response: {response.text[:200]}",
        )


async def compare_outcome(
    sim_result: SimulationResult,
    goal: str,
    code: str,
    provider: Optional["BaseLLMProvider"] = None,
    expected_volumes: Optional[dict[str, float]] = None,
    tolerance: float = 0.05,
) -> ComparisonResult:
    prog_result = programmatic_compare(sim_result, expected_volumes, tolerance)

    if prog_result.match:
        return prog_result

    if provider is not None and prog_result.score >= 0.5:
        return await llm_compare(provider, goal, code, sim_result)

    return prog_result
