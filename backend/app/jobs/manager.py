"""
Background Job Manager.
Manages asynchronous pipeline execution, event queues for SSE streaming,
status transitions (QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED), and logs.
"""
import asyncio
import time
import json
import traceback
from typing import Dict, Any, Optional, AsyncGenerator
import concurrent.futures

from app.pipeline.runner import run_pipeline
from app.storage.db import save_run_record, get_run_record


class JobState:
    def __init__(self, run_id: str, config: Dict[str, Any]):
        self.run_id = run_id
        self.config = config
        self.status = "QUEUED"  # QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
        self.created_at = time.strftime("%Y-%m-%d %H:%M:%S")
        self.completed_at: Optional[str] = None
        self.duration_seconds: Optional[float] = None
        self.error_message: Optional[str] = None
        self.events: list = []
        self.log_lines: list = []
        self.metrics: Optional[Dict[str, Any]] = None
        self.result: Optional[Dict[str, Any]] = None
        self.cancel_requested = False
        self.queue: asyncio.Queue = asyncio.Queue()


class JobManager:
    def __init__(self):
        self.jobs: Dict[str, JobState] = {}
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

    def create_job(self, run_id: str, config: Dict[str, Any]) -> JobState:
        if run_id in self.jobs and self.jobs[run_id].status == "RUNNING":
            raise ValueError(f"Run {run_id} is already currently running.")

        job = JobState(run_id, config)
        self.jobs[run_id] = job

        save_run_record(
            run_id=run_id,
            status="QUEUED",
            config=config,
            created_at=job.created_at
        )

        return job

    def start_job(self, run_id: str, loop: asyncio.AbstractEventLoop):
        job = self.jobs.get(run_id)
        if not job:
            raise ValueError(f"Job {run_id} not found.")

        job.status = "RUNNING"
        save_run_record(
            run_id=run_id,
            status="RUNNING",
            config=job.config,
            created_at=job.created_at
        )

        def progress_cb(event_data: Dict[str, Any]):
            event_data["run_id"] = run_id
            event_data["timestamp"] = time.strftime("%H:%M:%S")
            job.events.append(event_data)
            if "message" in event_data:
                job.log_lines.append(f"[{event_data['timestamp']}] {event_data['message']}")

            # Thread-safe event push to asyncio queue
            loop.call_soon_threadsafe(job.queue.put_nowait, event_data)

        def cancel_chk() -> bool:
            return job.cancel_requested

        def run_worker():
            start_t = time.time()
            try:
                result = run_pipeline(
                    config=job.config,
                    progress_callback=progress_cb,
                    cancel_check=cancel_chk
                )
                dur = round(time.time() - start_t, 2)
                job.status = "COMPLETED"
                job.completed_at = time.strftime("%Y-%m-%d %H:%M:%S")
                job.duration_seconds = dur
                job.result = result
                job.metrics = result.get("metrics")

                save_run_record(
                    run_id=run_id,
                    status="COMPLETED",
                    config=job.config,
                    created_at=job.created_at,
                    completed_at=job.completed_at,
                    duration_seconds=dur,
                    metrics=job.metrics
                )

                progress_cb({
                    "stage": "COMPLETED",
                    "stage_num": 7,
                    "total_stages": 7,
                    "message": "Run finished successfully!",
                    "progress": 1.0,
                    "metrics": job.metrics
                })

            except InterruptedError:
                dur = round(time.time() - start_t, 2)
                job.status = "CANCELLED"
                job.completed_at = time.strftime("%Y-%m-%d %H:%M:%S")
                job.duration_seconds = dur
                save_run_record(
                    run_id=run_id,
                    status="CANCELLED",
                    config=job.config,
                    created_at=job.created_at,
                    completed_at=job.completed_at,
                    duration_seconds=dur,
                    error_message="Cancelled by user"
                )
                progress_cb({
                    "stage": "CANCELLED",
                    "stage_num": 0,
                    "total_stages": 7,
                    "message": "Job cancellation processed.",
                    "progress": 0.0
                })
            except Exception as e:
                err_msg = str(e)
                tb = traceback.format_exc()
                dur = round(time.time() - start_t, 2)
                job.status = "FAILED"
                job.completed_at = time.strftime("%Y-%m-%d %H:%M:%S")
                job.duration_seconds = dur
                job.error_message = err_msg

                save_run_record(
                    run_id=run_id,
                    status="FAILED",
                    config=job.config,
                    created_at=job.created_at,
                    completed_at=job.completed_at,
                    duration_seconds=dur,
                    error_message=err_msg
                )
                progress_cb({
                    "stage": "FAILED",
                    "stage_num": 0,
                    "total_stages": 7,
                    "message": f"Run failed: {err_msg}",
                    "error": err_msg,
                    "traceback": tb,
                    "progress": 0.0
                })

        self.executor.submit(run_worker)

    def cancel_job(self, run_id: str) -> bool:
        job = self.jobs.get(run_id)
        if job and job.status in ["QUEUED", "RUNNING"]:
            job.cancel_requested = True
            return True
        return False

    def get_job(self, run_id: str) -> Optional[JobState]:
        return self.jobs.get(run_id)

    async def event_generator(self, run_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        job = self.jobs.get(run_id)
        if not job:
            yield {"event": "error", "data": json.dumps({"error": f"Job {run_id} not found"})}
            return

        # First yield past events
        for evt in job.events:
            yield {"event": "progress", "data": json.dumps(evt)}

        # If job already completed/failed/cancelled, yield final status and return
        if job.status in ["COMPLETED", "FAILED", "CANCELLED"]:
            yield {"event": "status", "data": json.dumps({"status": job.status, "metrics": job.metrics, "error": job.error_message})}
            return

        # Stream new events live
        while True:
            try:
                evt = await asyncio.wait_for(job.queue.get(), timeout=1.0)
                yield {"event": "progress", "data": json.dumps(evt)}
                if evt.get("stage") in ["COMPLETED", "FAILED", "CANCELLED"]:
                    break
            except asyncio.TimeoutError:
                if job.status in ["COMPLETED", "FAILED", "CANCELLED"]:
                    break
                # Keep-alive heartbeat
                yield {"event": "heartbeat", "data": json.dumps({"timestamp": time.strftime("%H:%M:%S")})}


job_manager = JobManager()
