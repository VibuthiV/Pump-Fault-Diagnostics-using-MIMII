"""
Run Comparison API Router.
Provides side-by-side comparison of multiple evaluation runs.
"""
from typing import List
from fastapi import APIRouter, HTTPException, Query

from app.storage.db import get_run_record

router = APIRouter()


@router.get("/runs/compare")
def compare_runs(run_ids: List[str] = Query(...)):
    """Compare multiple runs side-by-side."""
    if not run_ids or len(run_ids) < 2:
        raise HTTPException(status_code=400, detail="Please select at least two runs to compare.")

    compared = []
    for rid in run_ids:
        rec = get_run_record(rid)
        if rec:
            compared.append({
                "run_id": rec["run_id"],
                "created_at": rec["created_at"],
                "execution_mode": rec.get("execution_mode"),
                "dataset_split": rec.get("dataset_split"),
                "duration_seconds": rec.get("duration_seconds"),
                "metrics": rec.get("metrics"),
                "config": rec.get("config"),
            })
        else:
            compared.append({"run_id": rid, "found": False})

    return {"comparison": compared}
