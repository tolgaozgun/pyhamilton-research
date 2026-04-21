"""Simulation runs: run script in simulator and track runs."""
from __future__ import annotations

import uuid
import asyncio
import time
from datetime import datetime, timezone
from typing import Optional, Any
from collections import defaultdict

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.responses import ApiResponse

# Type alias for database session to avoid FastAPI issues
DbSession = AsyncSession
from sqlalchemy import select

from app.config import SimulationResult, LLMConfig, UserInput
from app.core.simulator import get_simulator
from app.core.agentic_runtime import run_python_interpreter, run_pytest_suite
from app.api.deps import get_provider
from app.core.pipeline import run_agentic_pipeline
from app.database import get_db
from app.models import UserSettings

router = APIRouter(prefix="/api/simulation", tags=["simulation"])

# In-memory store of simulation runs (per process)
_simulation_runs: dict[str, dict] = {}
_parallel_runs: dict[str, dict] = {}
_run_metrics: dict[str, dict] = {}


class RunSimulationRequest(BaseModel):
    code: str
    goal: str = ""
    name: Optional[str] = None


class ParallelSimulationConfig(BaseModel):
    """Configuration for parallel simulations"""
    scenarios: list[dict]  # List of scenario configs with goal, deck_config, etc.
    parallelism: int = 3  # Number of concurrent runs
    llm_provider: str = "anthropic"
    max_retries: int = 2
    tags: list[str] = []


class ParallelRunRequest(BaseModel):
    """Request to start parallel simulation run"""
    name: str
    config: ParallelSimulationConfig
    llm_config: Optional[dict] = None


class SimulationRunSummary(BaseModel):
    id: str
    name: Optional[str]
    goal: Optional[str]
    status: str  # "running" | "completed" | "failed"
    created_at: str
    success: Optional[bool] = None
    error: Optional[str] = None


class SimulationRunDetail(BaseModel):
    id: str
    name: Optional[str]
    goal: Optional[str]
    status: str
    created_at: str
    success: Optional[bool] = None
    error: Optional[str] = None
    result: Optional[SimulationResult] = None
    code_snippet: Optional[str] = None


class ScenarioMetrics(BaseModel):
    """Metrics for a single scenario run"""
    scenario_id: int
    scenario_name: str
    status: str  # "pending" | "running" | "completed" | "failed"
    duration_seconds: float
    success: bool
    error: Optional[str] = None
    token_usage: Optional[dict] = None
    retry_count: int = 0
    syntax_passed: bool = True
    interpreter_passed: bool = True
    pytest_passed: bool = True
    generated_script: Optional[str] = None


class ParallelRunMetrics(BaseModel):
    """Overall metrics for a parallel simulation run"""
    run_id: str
    name: str
    status: str  # "running" | "completed" | "failed" | "cancelled"
    total_scenarios: int
    completed_scenarios: int
    successful_scenarios: int
    failed_scenarios: int
    duration_seconds: float
    average_duration: float
    total_tokens_used: int
    scenarios: list[ScenarioMetrics]
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


async def _get_user_llm_config(provider: str, db: AsyncSession) -> dict:
    """Get user's LLM config from database"""
    result = await db.execute(
        select(UserSettings).where(
            UserSettings.user_id == "default",
            UserSettings.provider == provider
        )
    )
    settings = result.scalar_one_or_none()

    if not settings or not settings.api_key:
        raise HTTPException(
            status_code=400,
            detail=f"No API key configured for provider: {provider}"
        )

    return {
        "provider": provider,
        "api_key": settings.api_key,
        "model": settings.selected_model or "claude-sonnet-4-20250514",
        "temperature": settings.preferences.get("temperature", 0.7) if settings.preferences else 0.7,
        "max_tokens": settings.preferences.get("max_tokens", 4096) if settings.preferences else 4096,
    }


async def run_single_scenario(
    scenario: dict,
    llm_config: dict,
    scenario_idx: int,
    db: AsyncSession
) -> ScenarioMetrics:
    """Run a single agentic scenario and return metrics"""
    start_time = time.time()
    scenario_name = scenario.get("name", f"Scenario {scenario_idx + 1}")
    goal = scenario.get("goal", "")
    deck_config = scenario.get("deck_config")
    max_retries = scenario.get("max_retries", 2)

    token_usage = defaultdict(int)
    retry_count = 0
    error = None
    success = False
    generated_script = None

    syntax_passed = True
    interpreter_passed = True
    pytest_passed = True

    for attempt in range(max_retries + 1):
        try:
            # Create LLM config
            from app.api.deps import get_provider
            from app.config import LLMConfig

            llm_cfg = LLMConfig(
                provider=llm_config["provider"],
                api_key=llm_config["api_key"],
                model=llm_config.get("model", "claude-sonnet-4-20250514"),
                temperature=llm_config.get("temperature", 0.7),
                max_tokens=llm_config.get("max_tokens", 4096),
            )

            provider = await get_provider(llm_cfg)

            # Run the agentic pipeline
            from app.core.pipeline import PipelineState

            state = PipelineState(
                user_input=UserInput(
                    goal=goal,
                    deck_config=deck_config,
                    max_retries=1,  # Handle retries at scenario level
                ),
                llm_config=llm_cfg,
                max_retries=1,
            )

            if deck_config:
                try:
                    from app.deck import DeckConfiguration
                    deck = DeckConfiguration.model_validate(deck_config)
                    state.user_input.deck_config = deck.model_dump()
                except Exception:
                    pass

            # Collect events and track progress
            last_script = None
            async for event in run_agentic_pipeline(provider, state):
                # Track token usage from events
                if "usage" in event:
                    usage = event["usage"]
                    token_usage["prompt_tokens"] += usage.get("prompt_tokens", 0)
                    token_usage["completion_tokens"] += usage.get("completion_tokens", 0)
                    token_usage["total_tokens"] += usage.get("total_tokens", 0)

                # Capture generated script
                if event.get("type") == "generated":
                    last_script = event.get("script")
                elif event.get("type") == "verification":
                    syntax_passed = event.get("syntax_check", {}).get("passed", True)
                    interpreter_passed = event.get("interpreter_check", {}).get("passed", True)
                    pytest_passed = event.get("pytest_check", {}).get("passed", True)

            generated_script = last_script
            success = syntax_passed and interpreter_passed and pytest_passed
            error = None
            break

        except Exception as e:
            retry_count = attempt + 1
            error = str(e)
            if attempt >= max_retries:
                success = False
                break
            await asyncio.sleep(0.5)  # Brief pause before retry

    duration = time.time() - start_time

    return ScenarioMetrics(
        scenario_id=scenario_idx,
        scenario_name=scenario_name,
        status="completed" if success else "failed",
        duration_seconds=duration,
        success=success,
        error=error,
        token_usage=dict(token_usage) if token_usage else None,
        retry_count=retry_count,
        syntax_passed=syntax_passed,
        interpreter_passed=interpreter_passed,
        pytest_passed=pytest_passed,
        generated_script=generated_script[:500] if generated_script else None,
    )


@router.post("/parallel/start")
async def start_parallel_simulation(
    req: ParallelRunRequest,
    background_tasks: BackgroundTasks,
    db: DbSession = Depends(get_db)
):
    """Start a parallel simulation run"""
    run_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()

    # Get LLM config from database
    try:
        llm_config_dict = await _get_user_llm_config(
            req.config.llm_provider,
            db
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Initialize run state
    _parallel_runs[run_id] = {
        "run_id": run_id,
        "name": req.name,
        "status": "running",
        "total_scenarios": len(req.config.scenarios),
        "completed_scenarios": 0,
        "successful_scenarios": 0,
        "failed_scenarios": 0,
        "duration_seconds": 0,
        "average_duration": 0,
        "total_tokens_used": 0,
        "scenarios": [
            ScenarioMetrics(
                scenario_id=i,
                scenario_name=s.get("name", f"Scenario {i + 1}"),
                status="pending",
                duration_seconds=0,
                success=False,
            ).model_dump()
            for i, s in enumerate(req.config.scenarios)
        ],
        "created_at": now,
        "started_at": now,
        "completed_at": None,
        "config": req.config.model_dump(),
    }

    # Run in background
    async def run_parallel():
        start = time.time()

        # Create semaphore for parallelism control
        semaphore = asyncio.Semaphore(req.config.parallelism)

        async def run_with_semaphore(scenario_idx, scenario):
            async with semaphore:
                return await run_single_scenario(
                    scenario,
                    llm_config_dict,
                    scenario_idx,
                    db
                )

        # Run all scenarios in parallel
        tasks = [
            run_with_semaphore(i, scenario)
            for i, scenario in enumerate(req.config.scenarios)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Update run state with results
        run = _parallel_runs[run_id]
        total_tokens = 0
        total_duration = 0

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                result = ScenarioMetrics(
                    scenario_id=i,
                    scenario_name=run["scenarios"][i]["scenario_name"],
                    status="failed",
                    duration_seconds=0,
                    success=False,
                    error=str(result),
                )

            metrics = result if isinstance(result, ScenarioMetrics) else result
            run["scenarios"][i] = metrics.model_dump()
            run["completed_scenarios"] += 1
            if metrics.success:
                run["successful_scenarios"] += 1
            else:
                run["failed_scenarios"] += 1

            total_duration += metrics.duration_seconds
            if metrics.token_usage:
                total_tokens += metrics.token_usage.get("total_tokens", 0)

        run["duration_seconds"] = time.time() - start
        run["average_duration"] = total_duration / len(req.config.scenarios) if req.config.scenarios else 0
        run["total_tokens_used"] = total_tokens
        run["status"] = "completed"
        run["completed_at"] = datetime.now(timezone.utc).isoformat()

        # Store metrics
        _run_metrics[run_id] = run

    background_tasks.add_task(run_parallel)

    return ApiResponse.success(
        data={
            "run_id": run_id,
            "status": "started",
            "message": f"Started {len(req.config.scenarios)} scenarios with parallelism {req.config.parallelism}"
        },
        message="Parallel simulation started",
        status_code=201
    )


@router.get("/parallel/{run_id}")
async def get_parallel_run(run_id: str):
    """Get status and metrics of a parallel simulation run"""
    if run_id not in _parallel_runs:
        return ApiResponse.not_found(message="Run not found", resource_type="simulation_run")

    run = _parallel_runs[run_id]

    scenarios = [
        ScenarioMetrics.model_validate(s) if isinstance(s, dict) else s
        for s in run.get("scenarios", [])
    ]

    metrics = ParallelRunMetrics(
        run_id=run_id,
        name=run["name"],
        status=run["status"],
        total_scenarios=run["total_scenarios"],
        completed_scenarios=run["completed_scenarios"],
        successful_scenarios=run["successful_scenarios"],
        failed_scenarios=run["failed_scenarios"],
        duration_seconds=run["duration_seconds"],
        average_duration=run["average_duration"],
        total_tokens_used=run["total_tokens_used"],
        scenarios=scenarios,
        created_at=run["created_at"],
        started_at=run.get("started_at"),
        completed_at=run.get("completed_at"),
    )

    return ApiResponse.success(data=metrics.model_dump(), message="Run retrieved successfully")


@router.get("/parallel")
async def list_parallel_runs():
    """List all parallel simulation runs"""
    runs = []
    for run_id, run in _parallel_runs.items():
        scenarios = [
            ScenarioMetrics.model_validate(s) if isinstance(s, dict) else s
            for s in run.get("scenarios", [])
        ]
        runs.append(ParallelRunMetrics(
            run_id=run_id,
            name=run["name"],
            status=run["status"],
            total_scenarios=run["total_scenarios"],
            completed_scenarios=run["completed_scenarios"],
            successful_scenarios=run["successful_scenarios"],
            failed_scenarios=run["failed_scenarios"],
            duration_seconds=run["duration_seconds"],
            average_duration=run["average_duration"],
            total_tokens_used=run["total_tokens_used"],
            scenarios=scenarios,
            created_at=run["created_at"],
            started_at=run.get("started_at"),
            completed_at=run.get("completed_at"),
        ))

    sorted_runs = sorted(runs, key=lambda r: r.created_at, reverse=True)
    return ApiResponse.success(
        data=[r.model_dump() for r in sorted_runs],
        message="Parallel runs retrieved successfully"
    )


@router.delete("/parallel/{run_id}")
async def cancel_parallel_run(run_id: str):
    """Cancel a running parallel simulation"""
    if run_id not in _parallel_runs:
        return ApiResponse.not_found(message="Run not found", resource_type="simulation_run")

    run = _parallel_runs[run_id]
    if run["status"] == "running":
        run["status"] = "cancelled"
        run["completed_at"] = datetime.now(timezone.utc).isoformat()

    return ApiResponse.success(data={"status": "cancelled"}, message="Run cancelled")


@router.post("/run")
async def run_simulation(req: RunSimulationRequest):
    """Run script in the simulator and record the run."""
    run_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    code = (req.code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="code is required")

    # Store run as running first
    _simulation_runs[run_id] = {
        "id": run_id,
        "name": req.name or None,
        "goal": req.goal or None,
        "status": "running",
        "created_at": now,
        "success": None,
        "error": None,
        "result": None,
        "code_snippet": code[:2000] + ("..." if len(code) > 2000 else ""),
    }

    try:
        simulator = get_simulator("mock")
        result = simulator.simulate(code, req.goal or "")
        _simulation_runs[run_id]["status"] = "completed"
        _simulation_runs[run_id]["success"] = result.success
        _simulation_runs[run_id]["result"] = result.model_dump()
        if result.errors:
            _simulation_runs[run_id]["error"] = "; ".join(result.errors[:3])
        return ApiResponse.success(
            data={
                "id": run_id,
                "status": "completed",
                "success": result.success,
                "result": result.model_dump(),
            },
            message="Simulation completed"
        )
    except Exception as e:
        _simulation_runs[run_id]["status"] = "failed"
        _simulation_runs[run_id]["success"] = False
        _simulation_runs[run_id]["error"] = str(e)
        return ApiResponse.error(
            message=str(e),
            data={"id": run_id, "status": "failed"},
            status_code=500
        )


@router.get("/runs")
async def list_runs():
    """List all simulation runs, newest first."""
    runs = sorted(
        _simulation_runs.values(),
        key=lambda r: r["created_at"],
        reverse=True,
    )
    return ApiResponse.success(
        data=[
            {
                "id": r["id"],
                "name": r.get("name"),
                "goal": r.get("goal"),
                "status": r["status"],
                "created_at": r["created_at"],
                "success": r.get("success"),
                "error": r.get("error"),
            }
            for r in runs
        ],
        message="Runs retrieved successfully"
    )


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get one simulation run by id."""
    if run_id not in _simulation_runs:
        return ApiResponse.not_found(message="Run not found", resource_type="simulation_run")
    r = _simulation_runs[run_id]
    return ApiResponse.success(
        data={
            "id": r["id"],
            "name": r.get("name"),
            "goal": r.get("goal"),
            "status": r["status"],
            "created_at": r["created_at"],
            "success": r.get("success"),
            "error": r.get("error"),
            "result": r.get("result"),
            "code_snippet": r.get("code_snippet"),
        },
        message="Run retrieved successfully"
    )


@router.get("/metrics/summary")
async def get_metrics_summary():
    """Get overall metrics summary across all runs"""
    total_runs = len(_parallel_runs)
    completed_runs = [r for r in _parallel_runs.values() if r["status"] == "completed"]

    if not completed_runs:
        return ApiResponse.success(
            data={
                "total_runs": total_runs,
                "completed_runs": 0,
                "total_scenarios": 0,
                "success_rate": 0,
                "average_duration": 0,
                "total_tokens_used": 0,
            },
            message="Metrics retrieved successfully"
        )

    total_scenarios = sum(r["total_scenarios"] for r in completed_runs)
    successful_scenarios = sum(r["successful_scenarios"] for r in completed_runs)
    total_duration = sum(r["duration_seconds"] for r in completed_runs)
    total_tokens = sum(r["total_tokens_used"] for r in completed_runs)

    return ApiResponse.success(
        data={
            "total_runs": total_runs,
            "completed_runs": len(completed_runs),
            "total_scenarios": total_scenarios,
            "successful_scenarios": successful_scenarios,
            "failed_scenarios": total_scenarios - successful_scenarios,
            "success_rate": successful_scenarios / total_scenarios if total_scenarios > 0 else 0,
            "average_duration": total_duration / len(completed_runs) if completed_runs else 0,
            "total_tokens_used": total_tokens,
            "average_tokens_per_scenario": total_tokens / total_scenarios if total_scenarios > 0 else 0,
        },
        message="Metrics retrieved successfully"
    )


@router.post("/seed")
async def seed_simulation_data():
    """Seed the simulation with realistic demo data for presentations"""
    if len(_parallel_runs) > 0:
        return ApiResponse.success(
            data={"runs_count": len(_parallel_runs)},
            message="Data already seeded"
        )

    now = datetime.now(timezone.utc)

    # Demo run 1: ELISA Plate Preparation
    run1_id = str(uuid.uuid4())[:8]
    run1_scenarios = [
        ScenarioMetrics(
            scenario_id=0,
            scenario_name="Plate Coating",
            status="completed",
            duration_seconds=45.2,
            success=True,
            token_usage={"prompt_tokens": 1523, "completion_tokens": 2341, "total_tokens": 3864},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=1,
            scenario_name="Sample Dilution Series",
            status="completed",
            duration_seconds=52.8,
            success=True,
            token_usage={"prompt_tokens": 1892, "completion_tokens": 3124, "total_tokens": 5016},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=2,
            scenario_name="Reagent Addition",
            status="completed",
            duration_seconds=38.5,
            success=True,
            token_usage={"prompt_tokens": 1456, "completion_tokens": 2891, "total_tokens": 4347},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
    ]

    _parallel_runs[run1_id] = {
        "run_id": run1_id,
        "name": "ELISA Plate Prep - Week 12",
        "status": "completed",
        "total_scenarios": 3,
        "completed_scenarios": 3,
        "successful_scenarios": 3,
        "failed_scenarios": 0,
        "duration_seconds": 136.5,
        "average_duration": 45.5,
        "total_tokens_used": 13227,
        "scenarios": [s.model_dump() for s in run1_scenarios],
        "created_at": (now - __import__('datetime').timedelta(hours=2)).isoformat(),
        "started_at": (now - __import__('datetime').timedelta(hours=2)).isoformat(),
        "completed_at": (now - __import__('datetime').timedelta(hours=2, minutes=-57)).isoformat(),
    }

    # Demo run 2: PCR Setup with one failure
    run2_id = str(uuid.uuid4())[:8]
    run2_scenarios = [
        ScenarioMetrics(
            scenario_id=0,
            scenario_name="Master Mix Preparation",
            status="completed",
            duration_seconds=41.3,
            success=True,
            token_usage={"prompt_tokens": 1678, "completion_tokens": 2567, "total_tokens": 4245},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=1,
            scenario_name="Template Transfer",
            status="completed",
            duration_seconds=35.8,
            success=False,
            error="Aspiration volume exceeds tip capacity",
            token_usage={"prompt_tokens": 1432, "completion_tokens": 2102, "total_tokens": 3534},
            retry_count=1,
            syntax_passed=True,
            interpreter_passed=False,
            pytest_passed=False,
        ),
        ScenarioMetrics(
            scenario_id=2,
            scenario_name="Plate Sealing",
            status="completed",
            duration_seconds=28.4,
            success=True,
            token_usage={"prompt_tokens": 1234, "completion_tokens": 1876, "total_tokens": 3110},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=3,
            scenario_name="Thermal Cycler Transfer",
            status="completed",
            duration_seconds=32.1,
            success=True,
            token_usage={"prompt_tokens": 1389, "completion_tokens": 2234, "total_tokens": 3623},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
    ]

    _parallel_runs[run2_id] = {
        "run_id": run2_id,
        "name": "PCR Automation Test",
        "status": "completed",
        "total_scenarios": 4,
        "completed_scenarios": 4,
        "successful_scenarios": 3,
        "failed_scenarios": 1,
        "duration_seconds": 137.6,
        "average_duration": 34.4,
        "total_tokens_used": 14512,
        "scenarios": [s.model_dump() for s in run2_scenarios],
        "created_at": (now - __import__('datetime').timedelta(hours=5)).isoformat(),
        "started_at": (now - __import__('datetime').timedelta(hours=5)).isoformat(),
        "completed_at": (now - __import__('datetime').timedelta(hours=4, minutes=-58)).isoformat(),
    }

    # Demo run 3: High-throughput screening - recent
    run3_id = str(uuid.uuid4())[:8]
    run3_scenarios = [
        ScenarioMetrics(
            scenario_id=0,
            scenario_name="Compound Transfer A",
            status="completed",
            duration_seconds=48.7,
            success=True,
            token_usage={"prompt_tokens": 1789, "completion_tokens": 3012, "total_tokens": 4801},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=1,
            scenario_name="Compound Transfer B",
            status="completed",
            duration_seconds=46.3,
            success=True,
            token_usage={"prompt_tokens": 1723, "completion_tokens": 2876, "total_tokens": 4599},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=2,
            scenario_name="Incubation Step",
            status="completed",
            duration_seconds=29.5,
            success=True,
            token_usage={"prompt_tokens": 1345, "completion_tokens": 2034, "total_tokens": 3379},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=3,
            scenario_name="Readout Transfer",
            status="completed",
            duration_seconds=44.1,
            success=True,
            token_usage={"prompt_tokens": 1657, "completion_tokens": 2789, "total_tokens": 4446},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=4,
            scenario_name="Plate Washing",
            status="completed",
            duration_seconds=51.8,
            success=True,
            token_usage={"prompt_tokens": 1892, "completion_tokens": 3245, "total_tokens": 5137},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
    ]

    _parallel_runs[run3_id] = {
        "run_id": run3_id,
        "name": "HTS Compound Screening - Batch 47",
        "status": "completed",
        "total_scenarios": 5,
        "completed_scenarios": 5,
        "successful_scenarios": 5,
        "failed_scenarios": 0,
        "duration_seconds": 220.4,
        "average_duration": 44.08,
        "total_tokens_used": 22362,
        "scenarios": [s.model_dump() for s in run3_scenarios],
        "created_at": (now - __import__('datetime').timedelta(minutes=30)).isoformat(),
        "started_at": (now - __import__('datetime').timedelta(minutes=30)).isoformat(),
        "completed_at": (now - __import__('datetime').timedelta(minutes=26)).isoformat(),
    }

    # Demo run 4: Serial Dilution - recent successful run
    run4_id = str(uuid.uuid4())[:8]
    run4_scenarios = [
        ScenarioMetrics(
            scenario_id=0,
            scenario_name="1:10 Dilution Series",
            status="completed",
            duration_seconds=42.5,
            success=True,
            token_usage={"prompt_tokens": 1634, "completion_tokens": 2756, "total_tokens": 4390},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=1,
            scenario_name="1:100 Dilution Series",
            status="completed",
            duration_seconds=44.8,
            success=True,
            token_usage={"prompt_tokens": 1689, "completion_tokens": 2891, "total_tokens": 4580},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=2,
            scenario_name="1:1000 Dilution Series",
            status="completed",
            duration_seconds=43.2,
            success=True,
            token_usage={"prompt_tokens": 1656, "completion_tokens": 2823, "total_tokens": 4479},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
    ]

    _parallel_runs[run4_id] = {
        "run_id": run4_id,
        "name": "Antibody Titration - Dilution Series",
        "status": "completed",
        "total_scenarios": 3,
        "completed_scenarios": 3,
        "successful_scenarios": 3,
        "failed_scenarios": 0,
        "duration_seconds": 130.5,
        "average_duration": 43.5,
        "total_tokens_used": 13449,
        "scenarios": [s.model_dump() for s in run4_scenarios],
        "created_at": (now - __import__('datetime').timedelta(minutes=15)).isoformat(),
        "started_at": (now - __import__('datetime').timedelta(minutes=15)).isoformat(),
        "completed_at": (now - __import__('datetime').timedelta(minutes=12)).isoformat(),
    }

    # Demo run 5: Larger comprehensive test - mixed results
    run5_id = str(uuid.uuid4())[:8]
    run5_scenarios = [
        ScenarioMetrics(
            scenario_id=0,
            scenario_name="Sample Preparation",
            status="completed",
            duration_seconds=38.2,
            success=True,
            token_usage={"prompt_tokens": 1456, "completion_tokens": 2423, "total_tokens": 3879},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=1,
            scenario_name="Standard Curve Generation",
            status="completed",
            duration_seconds=55.4,
            success=True,
            token_usage={"prompt_tokens": 1923, "completion_tokens": 3456, "total_tokens": 5379},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=2,
            scenario_name="Unknown Sample Analysis",
            status="completed",
            duration_seconds=48.9,
            success=True,
            token_usage={"prompt_tokens": 1789, "completion_tokens": 2987, "total_tokens": 4776},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
        ScenarioMetrics(
            scenario_id=3,
            scenario_name="Quality Control Check",
            status="completed",
            duration_seconds=33.1,
            success=False,
            error="Control sample outside acceptable range",
            token_usage={"prompt_tokens": 1345, "completion_tokens": 2134, "total_tokens": 3479},
            retry_count=1,
            syntax_passed=True,
            interpreter_passed=False,
            pytest_passed=False,
        ),
        ScenarioMetrics(
            scenario_id=4,
            scenario_name="Data Export",
            status="completed",
            duration_seconds=25.7,
            success=True,
            token_usage={"prompt_tokens": 1123, "completion_tokens": 1789, "total_tokens": 2912},
            retry_count=0,
            syntax_passed=True,
            interpreter_passed=True,
            pytest_passed=True,
        ),
    ]

    _parallel_runs[run5_id] = {
        "run_id": run5_id,
        "name": "Analytical Method Validation",
        "status": "completed",
        "total_scenarios": 5,
        "completed_scenarios": 5,
        "successful_scenarios": 4,
        "failed_scenarios": 1,
        "duration_seconds": 201.3,
        "average_duration": 40.26,
        "total_tokens_used": 20425,
        "scenarios": [s.model_dump() for s in run5_scenarios],
        "created_at": (now - __import__('datetime').timedelta(hours=1)).isoformat(),
        "started_at": (now - __import__('datetime').timedelta(hours=1)).isoformat(),
        "completed_at": (now - __import__('datetime').timedelta(minutes=-20)).isoformat(),
    }

    return ApiResponse.success(
        data={
            "runs_count": 5,
            "total_scenarios": 20,
            "successful_scenarios": 18,
            "failed_scenarios": 2,
            "overall_success_rate": 0.9,
        },
        message="Seeded demo data for presentation"
    )
