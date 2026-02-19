from typing import Optional
from config import Mode


def build_simple_prompt(procedure: str, rag_context: str = "") -> str:
    ctx = f"\n\n## Reference Documentation\n{rag_context}" if rag_context else ""
    return f"""## Protocol Request
{procedure}
{ctx}
## Task
Generate a complete, self-contained PyHamilton Python script implementing the described protocol.
Include all imports, initialization, and cleanup. Use simulate=True."""


def build_feasibility_prompt(procedure: str, rag_context: str = "") -> str:
    ctx = f"\n\n## Reference Documentation\n{rag_context}" if rag_context else ""
    return f"""## Procedure Description
{procedure}
{ctx}
## Task
Assess whether this procedure is feasible with PyHamilton and standard Hamilton hardware.

Consider:
- Can all described operations be performed with available PyHamilton API calls?
- Are the volumes, plate types, and operations physically reasonable?
- Are there any ambiguities or missing information?

Respond with ONLY a JSON object:
{{
  "feasible": true/false,
  "reasoning": "Brief explanation",
  "concerns": ["list of concerns or missing info, empty if none"],
  "suggestions": ["optional suggestions to improve the procedure"]
}}"""


def build_labware_map_prompt(
    procedure: str,
    user_labware: str = "",
    rag_context: str = "",
) -> str:
    labware_note = f"\n\nUser-specified labware/locations:\n{user_labware}" if user_labware else ""
    ctx = f"\n\n## Reference Documentation\n{rag_context}" if rag_context else ""
    return f"""## Procedure Description
{procedure}
{labware_note}
{ctx}
## Task
Generate a labware map for this procedure. Include:
1. All labware items needed (plates, tip racks, troughs, reservoirs)
2. Deck position assignments (positions 1-24)
3. An expected outcome description (final deck state after successful execution)

Respond with ONLY a JSON object:
{{
  "labware": [
    {{"name": "labware_name", "type": "Plate96|Tip96|Reservoir|etc", "deck_position": 1, "description": "purpose"}}
  ],
  "deck_layout": {{
    "1": "labware_name",
    "2": "another_labware"
  }},
  "expected_outcome": "Description of the final state after successful execution"
}}"""


def build_generation_prompt(
    procedure: str,
    labware_map_text: str = "",
    expected_outcome: str = "",
    rag_context: str = "",
) -> str:
    parts = [f"## Protocol Request\n{procedure}"]

    if labware_map_text:
        parts.append(f"## Approved Labware Map\n{labware_map_text}")

    if expected_outcome:
        parts.append(f"## Expected Outcome\n{expected_outcome}")

    if rag_context:
        parts.append(f"## Reference Documentation\n{rag_context}")

    parts.append(
        "## Task\n"
        "Generate a complete, self-contained PyHamilton Python script implementing "
        "the described protocol using the specified labware map and deck positions.\n"
        "Include all imports, initialization, operations, and cleanup."
    )

    return "\n\n".join(parts)


def build_fix_prompt(
    script: str,
    errors: list[str],
    error_context: str = "",
    rag_context: str = "",
) -> str:
    error_list = "\n".join(f"- {e}" for e in errors)
    parts = [f"## Errors Found\n{error_list}"]

    if error_context:
        parts.append(f"## Error Context\n{error_context}")

    if rag_context:
        parts.append(f"## Reference Documentation\n{rag_context}")

    parts.append(f"## Current Script\n```python\n{script}\n```")
    parts.append(
        "## Task\n"
        "Fix the script to resolve all errors listed above. "
        "Preserve working parts of the script. "
        "Output ONLY the corrected Python code, no markdown fences."
    )

    return "\n\n".join(parts)
