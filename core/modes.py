"""Mode definitions per Updated PRD v2.

Simple: no validation, just generate + download.
Developer: 8-step validated pipeline with user review checkpoints.
Agentic: Developer pipeline + autonomous retry loop.
"""

from config import Mode, PipelineStep


DEVELOPER_PIPELINE_STEPS = [
    PipelineStep.INPUT,
    PipelineStep.FEASIBILITY,
    PipelineStep.LABWARE_MAP,
    PipelineStep.CODE_GENERATION,
    PipelineStep.SYNTAX_CHECK,
    PipelineStep.SIMULATION,
    PipelineStep.OUTCOME_COMPARISON,
    PipelineStep.RESULTS,
]


def get_pipeline_steps(mode: Mode) -> list[PipelineStep]:
    if mode == Mode.SIMPLE:
        return [PipelineStep.INPUT, PipelineStep.CODE_GENERATION, PipelineStep.RESULTS]
    return DEVELOPER_PIPELINE_STEPS
