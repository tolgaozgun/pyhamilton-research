"""Agentic workflow — thin wrapper since the pipeline handles retry logic.

The agentic pipeline is implemented in core.pipeline.run_agentic_pipeline.
This module re-exports it and provides any agent-specific utilities.
"""

from core.pipeline import run_agentic_pipeline

__all__ = ["run_agentic_pipeline"]
