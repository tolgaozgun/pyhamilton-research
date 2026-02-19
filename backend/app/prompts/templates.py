from __future__ import annotations

from typing import Optional


def build_simple_prompt(
    goal: str,
    context: Optional[str] = None,
    rag_context: str = "",
) -> str:
    parts = [f"## Task\nGenerate a PyHamilton script for:\n{goal}"]
    if context:
        parts.append(f"\n## Additional Context\n{context}")
    if rag_context:
        parts.append(f"\n{rag_context}")
    parts.append(
        "\n## Requirements\n"
        "- Include all imports\n"
        "- Initialize HamiltonInterface and LayoutManager\n"
        "- Use try/finally with ham.stop()\n"
        "- Return complete, runnable Python code in a ```python code block"
    )
    return "\n".join(parts)


def build_feasibility_prompt(goal: str, context: Optional[str] = None) -> str:
    parts = [
        "## Feasibility Analysis\n"
        "Analyze whether the following automation task is feasible with a Hamilton STAR robot "
        "and the PyHamilton library.\n",
        f"**Goal:** {goal}",
    ]
    if context:
        parts.append(f"\n**Context:** {context}")
    parts.append(
        "\n\nProvide:\n"
        "1. Whether this is feasible (YES/NO/PARTIAL)\n"
        "2. Required hardware capabilities\n"
        "3. Estimated number of tips needed\n"
        "4. Potential risks or limitations\n"
        "5. Suggested approach"
    )
    return "\n".join(parts)


def build_labware_map_prompt(goal: str, feasibility: str) -> str:
    return (
        "## Labware Map Generation\n\n"
        f"**Goal:** {goal}\n\n"
        f"**Feasibility Analysis:**\n{feasibility}\n\n"
        "Based on the goal and feasibility analysis, create a labware map.\n"
        "List each deck position and what should be placed there:\n\n"
        "Format:\n"
        "- Position X: [Labware Type] - [Purpose]\n"
        "- Tips needed: [list tip types and quantities]\n"
        "- Plates: [list plates and purposes]\n"
        "- Reservoirs: [list reservoirs and contents]"
    )


def build_generation_prompt(
    goal: str,
    feasibility: str,
    labware_map: str,
    rag_context: str = "",
) -> str:
    parts = [
        "## Code Generation\n\n"
        f"**Goal:** {goal}\n\n"
        f"**Feasibility:**\n{feasibility}\n\n"
        f"**Labware Map:**\n{labware_map}",
    ]
    if rag_context:
        parts.append(f"\n{rag_context}")
    parts.append(
        "\n\n## Instructions\n"
        "Generate a complete PyHamilton script that:\n"
        "1. Imports all necessary modules\n"
        "2. Initializes HamiltonInterface\n"
        "3. Sets up labware using LayoutManager\n"
        "4. Implements the automation logic\n"
        "5. Handles errors gracefully\n"
        "6. Cleans up in a finally block\n\n"
        "Return the code in a ```python code block."
    )
    return "\n".join(parts)


def build_fix_prompt(
    code: str,
    errors: list[str],
    warnings: list[str],
    comparison: str = "",
) -> str:
    parts = [
        "## Fix Required\n\n"
        "The following PyHamilton script has issues that need to be fixed.\n\n"
        f"### Current Code\n```python\n{code}\n```\n"
    ]
    if errors:
        parts.append(f"\n### Errors\n" + "\n".join(f"- {e}" for e in errors))
    if warnings:
        parts.append(f"\n### Warnings\n" + "\n".join(f"- {w}" for w in warnings))
    if comparison:
        parts.append(f"\n### Comparison Feedback\n{comparison}")
    parts.append(
        "\n\n## Instructions\n"
        "Fix the issues above. Make targeted changes — do not rewrite working code.\n"
        "Return the corrected code in a ```python code block."
    )
    return "\n".join(parts)
