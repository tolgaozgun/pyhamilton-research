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


def build_agentic_validate_prompt(
    phase: str,
    goal: str,
    deck_context: str = "",
    procedure_context: str = "",
    knowledge_context: str = "",
) -> str:
    def _kb(kc: str) -> list[str]:
        return [f"\n{kc}"] if kc else []

    if phase == "deck_layout":
        parts = [
            "## Deck Layout Validation",
            "Validate the following Hamilton STAR deck configuration for PyHamilton.",
            "",
            f"## Automation Goal\n{goal}",
            f"## Deck Configuration\n{deck_context or '(no deck configured)'}",
        ]
        parts.extend(_kb(knowledge_context))
        parts.extend([
            "",
            "Assess:",
            "1. Are the carrier placements physically valid (no rail conflicts, within deck bounds)?",
            "2. Is the labware present and appropriate for the stated goal?",
            "3. Are tip racks present for aspirate/dispense operations?",
            "",
            "Respond with exactly VALID or INVALID on the first line, then a brief explanation (2-4 sentences).",
        ])
        return "\n".join(parts)
    if phase == "procedure":
        parts = [
            "## Procedure Validation",
            "Validate the following automation procedure description for PyHamilton script generation.",
            "",
            f"## Automation Goal\n{goal}",
            f"## Deck Configuration\n{deck_context or '(none)'}",
            f"## Procedure Description\n{procedure_context or '(none)'}",
        ]
        parts.extend(_kb(knowledge_context))
        parts.extend([
            "",
            "Assess whether the procedure is complete and specific enough to generate a correct PyHamilton script.",
            "Check that each of the following is clear or reasonably inferable:",
            "1. Source and destination labware positions",
            "2. Volumes to transfer",
            "3. Tip strategy (replace per sample, reuse, etc.)",
            "4. Number of samples, wells, or cycles",
            "",
            "Respond with exactly VALID or INVALID on the first line, then a brief explanation (2-4 sentences).",
        ])
        return "\n".join(parts)
    parts = [
        f"## Validation — phase: {phase}",
        f"Goal: {goal}",
    ]
    parts.extend(_kb(knowledge_context))
    parts.append("Is this step complete and ready to proceed? Respond with VALID or INVALID on the first line, then a brief explanation.")
    return "\n".join(parts)


def build_agentic_chat_prompt(
    phase: str,
    goal: str,
    conversation: str,
    deck_context: str = "",
    procedure_context: str = "",
    generation_context: str = "",
) -> str:
    phase_instructions = {
        "deck_layout": (
            "You are validating a Hamilton deck layout for PyHamilton. Ask exactly one targeted question "
            "if anything is missing or ambiguous. If the deck layout is valid and ready for use, respond with "
            "exactly READY on the first line and a brief summary on the next line."
        ),
        "procedure": (
            "You are helping define the procedure that will run on the validated deck. Ask exactly one targeted "
            "question per turn. If the procedure is complete, respond with exactly READY on the first line and "
            "a concise summary on the next line."
        ),
        "generation": (
            "You are helping with final generation constraints before code creation. Ask exactly one targeted "
            "question if needed. If enough detail is present, respond with exactly READY on the first line and "
            "a concise summary on the next line."
        ),
    }
    instructions = phase_instructions.get(phase, phase_instructions["procedure"])
    parts = [
        "## Agentic Conversation",
        instructions,
        "",
        f"## Phase\n{phase}",
        f"## Goal\n{goal}",
    ]
    if deck_context:
        parts.append(f"## Deck Context\n{deck_context}")
    if procedure_context:
        parts.append(f"## Procedure Context\n{procedure_context}")
    if generation_context:
        parts.append(f"## Generation Context\n{generation_context}")
    parts.extend([
        "## Conversation So Far",
        conversation or "(none)",
        "",
        "Return either one question or READY. Do not ask multiple questions.",
    ])
    return "\n".join(parts)


def build_agentic_generation_prompt(
    goal: str,
    deck_context: str,
    procedure_context: str,
    rag_context: str = "",
) -> str:
    parts = [
        "## Final Generation",
        "Generate both a production-ready PyHamilton script and a pytest file that validates the script at a useful level.",
        "",
        f"## Goal\n{goal}",
    ]
    if deck_context:
        parts.append(f"## Deck Context\n{deck_context}")
    if procedure_context:
        parts.append(f"## Procedure Summary\n{procedure_context}")
    if rag_context:
        parts.append(f"## Reference Context\n{rag_context}")
    parts.append(
        "## Output Requirements\n"
        "- Return exactly two Python code blocks: first the script, second the tests\n"
        "- The script must be import-safe and keep execution behind `if __name__ == '__main__'`\n"
        "- The tests should mock or stub hardware-facing pieces and focus on behavior, structure, and safety\n"
        "- Avoid inventing PyHamilton APIs that are not necessary\n"
        "- Include brief comments only where they help the reader understand the workflow"
    )
    return "\n".join(parts)


def build_agentic_fix_prompt(
    goal: str,
    deck_context: str,
    procedure_context: str,
    script: str,
    tests: str,
    verification_feedback: str,
    knowledge_context: str = "",
) -> str:
    parts = [
        "## Fix Agentic Output",
        "The generated script or tests failed verification. Make targeted fixes only.",
        "",
        f"## Goal\n{goal}",
    ]
    if deck_context:
        parts.append(f"## Deck Context\n{deck_context}")
    if procedure_context:
        parts.append(f"## Procedure Summary\n{procedure_context}")
    if knowledge_context:
        parts.append(knowledge_context)
    parts.extend(
        [
            "## Current Script",
            f"```python\n{script}\n```",
            "",
            "## Current Tests",
            f"```python\n{tests}\n```",
            "",
            "## Verification Feedback",
            verification_feedback,
            "",
            "Return exactly two Python code blocks again: first the corrected script, then the corrected tests.",
        ]
    )
    return "\n".join(parts)
