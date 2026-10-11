"""
Runs Management API Router.
Provides validation, explicit creation, history listing, SSE progress streaming, and cancellation.
"""
import asyncio
import shutil
import time
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.schemas.pipeline import (
    RunValidateRequest, RunValidateResponse, RunCreateRequest, RunStatusResponse
)
from app.pipeline.dataset import load_manifest, validate_manifest
from app.jobs.manager import job_manager
from app.storage.db import delete_run_record, get_run_record, list_run_records

router = APIRouter()


@router.post("/runs/validate", response_model=RunValidateResponse)
def validate_run_config(req: RunValidateRequest):
    """Validate proposed run configuration before execution."""
    warnings = []
    dataset_info = {}

    # 1. Dataset check
    requested_root = (req.dataset_root or "").strip()
    use_configured_root = requested_root in {"", ".", "./", settings.dataset_root}
    d_root = str(settings.get_dataset_root()) if use_configured_root else requested_root
    try:
        df = load_manifest(d_root)
        val = validate_manifest(df, check_files=True)
        if not val["valid"]:
            return RunValidateResponse(valid=False, error=val.get("error", "Invalid manifest"))
        dataset_info = {
            "total_samples": val["total_samples"],
            "split_counts": val["split_counts"],
            "machines": val["machines"],
            "snrs": val["snrs"],
            "eval_split_count": val["split_counts"].get(req.split, 0),
        }
        if val["split_counts"].get(req.split, 0) == 0:
            return RunValidateResponse(
                valid=False,
                error=f"No samples in dataset for split '{req.split}'."
            )
    except Exception as e:
        return RunValidateResponse(valid=False, error=f"Dataset error: {str(e)}")

    # 2. Checkpoint check
    chk_path = settings.get_checkpoint_path()
    chk_found = (
        chk_path.exists() or
        Path("spec_only_checkpoint").exists() or
        Path("spec_only_checkpoint.pt").exists()
    )

    if req.execution_mode == "checkpoint_only" and not chk_found:
        return RunValidateResponse(
            valid=False,
            error="Checkpoint evaluation requested, but no existing checkpoint was found."
        )

    if req.execution_mode in ["train_and_eval", "full_pipeline"] and chk_found and req.skip_training_if_checkpoint_exists:
        warnings.append("Training mode selected with checkpoint-reuse enabled: existing checkpoint will be reused.")

    # 3. Groq API check
    groq_key = req.groq_api_key or settings.groq_api_key
    groq_avail = bool(req.enable_groq and groq_key and groq_key.strip())
    if req.enable_groq and not groq_avail:
        warnings.append("Groq API key is missing. Rule-based decisions will run, but LLM text generation will be skipped.")

    # Duration estimate
    est_dur = "Fast (~10-30s)" if req.execution_mode == "checkpoint_only" or req.skip_training_if_checkpoint_exists else (
        "Quick Demo (~1-3 mins)" if req.quick_demo else "Full Training (~10-20 mins)"
    )

    return RunValidateResponse(
        valid=True,
        warnings=warnings,
        dataset_info=dataset_info,
        checkpoint_found=chk_found,
        checkpoint_path=str(chk_path),
        groq_available=groq_avail,
        estimated_duration=est_dur,
    )


@router.post("/runs", response_model=RunStatusResponse)
async def create_run(req: RunCreateRequest, request: Request):
    """Create and start a new background execution run after explicit frontend confirmation."""
    timestamp = int(time.time())
    run_id = f"run_{timestamp}"

    config_dict = req.model_dump()
    config_dict["run_id"] = run_id

    try:
        job = job_manager.create_job(run_id, config_dict)
        loop = asyncio.get_running_loop()
        job_manager.start_job(run_id, loop)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return RunStatusResponse(
        run_id=run_id,
        status=job.status,
        created_at=job.created_at,
        execution_mode=job.config.get("execution_mode", "checkpoint_only"),
        dataset_split=job.config.get("split", "test"),
        config=job.config
    )


@router.get("/runs", response_model=List[RunStatusResponse])
def list_runs(limit: int = 50, offset: int = 0):
    """Retrieve history of runs."""
    records = list_run_records(limit=limit, offset=offset)
    res = []
    for r in records:
        res.append(RunStatusResponse(
            run_id=r["run_id"],
            status=r["status"],
            created_at=r["created_at"],
            completed_at=r.get("completed_at"),
            duration_seconds=r.get("duration_seconds"),
            execution_mode=r.get("execution_mode", "checkpoint_only"),
            dataset_split=r.get("dataset_split", "test"),
            device=r.get("device"),
            error_message=r.get("error_message"),
            metrics=r.get("metrics"),
            config=r.get("config"),
        ))
    return res


@router.get("/runs/{run_id}", response_model=RunStatusResponse)
def get_run(run_id: str):
    """Retrieve details for a specific run."""
    # Check active job memory first
    job = job_manager.get_job(run_id)
    if job:
        return RunStatusResponse(
            run_id=job.run_id,
            status=job.status,
            created_at=job.created_at,
            completed_at=job.completed_at,
            duration_seconds=job.duration_seconds,
            execution_mode=job.config.get("execution_mode", "checkpoint_only"),
            dataset_split=job.config.get("split", "test"),
            error_message=job.error_message,
            metrics=job.metrics,
            config=job.config
        )

    # Fallback to database
    record = get_run_record(run_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found.")

    return RunStatusResponse(
        run_id=record["run_id"],
        status=record["status"],
        created_at=record["created_at"],
        completed_at=record.get("completed_at"),
        duration_seconds=record.get("duration_seconds"),
        execution_mode=record.get("execution_mode", "checkpoint_only"),
        dataset_split=record.get("dataset_split", "test"),
        device=record.get("device"),
        error_message=record.get("error_message"),
        metrics=record.get("metrics"),
        config=record.get("config")
    )


@router.delete("/runs/{run_id}")
def delete_run(run_id: str):
    """Delete a completed or failed run and its generated artifacts."""
    job = job_manager.get_job(run_id)
    if job and job.status in ["QUEUED", "RUNNING"]:
        raise HTTPException(status_code=409, detail="Running runs cannot be deleted.")

    record = get_run_record(run_id)
    if not record and not job:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found.")

    run_dir = settings.get_runs_dir() / run_id
    if run_dir.exists():
        shutil.rmtree(run_dir)
    delete_run_record(run_id)
    if job:
        job_manager.jobs.pop(run_id, None)
    return {"message": f"Run {run_id} deleted."}


@router.get("/runs/{run_id}/events")
async def stream_run_events(run_id: str):
    """Server-Sent Events (SSE) stream for live progress monitoring."""
    generator = job_manager.event_generator(run_id)
    return EventSourceResponse(generator)


@router.post("/runs/{run_id}/cancel")
def cancel_run(run_id: str):
    """Request safe cancellation of a running job."""
    success = job_manager.cancel_job(run_id)
    if not success:
        raise HTTPException(status_code=400, detail=f"Run {run_id} cannot be cancelled or is not running.")
    return {"message": f"Cancellation requested for run {run_id}."}
