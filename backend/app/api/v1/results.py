"""
Results and Artifacts API Router.
Returns metrics, predictions, ROC/PR curves, breakdowns, reports, and downloadable artifacts.
"""
import json
from pathlib import Path
from typing import Optional, List, Dict, Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse

from app.config import settings
from app.evaluation.metrics import compute_metrics, compute_group_breakdown, compute_matrix_breakdown

router = APIRouter()


def _get_run_dir(run_id: str) -> Path:
    run_dir = settings.get_runs_dir() / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail=f"Run artifacts for '{run_id}' not found.")
    return run_dir


@router.get("/runs/{run_id}/summary")
def get_run_summary(run_id: str):
    run_dir = _get_run_dir(run_id)
    summary_file = run_dir / "summary_report.json"
    if summary_file.exists():
        with open(summary_file, "r") as f:
            return json.load(f)

    metrics_file = run_dir / "metrics.json"
    if not metrics_file.exists():
        raise HTTPException(status_code=404, detail="Run metrics not available.")

    with open(metrics_file, "r") as f:
        metrics = json.load(f)

    return {"run_id": run_id, "metrics": metrics}


@router.get("/runs/{run_id}/metrics")
def get_run_metrics(run_id: str, threshold: Optional[float] = None):
    run_dir = _get_run_dir(run_id)

    # If threshold specified, perform dynamic post-hoc calculation from test_predictions.csv
    if threshold is not None:
        csv_file = run_dir / "test_predictions.csv"
        if not csv_file.exists():
            raise HTTPException(status_code=404, detail="Prediction records not found.")
        df = pd.read_csv(csv_file)
        return compute_metrics(df["label"].values, df["prob"].values, threshold=threshold)

    metrics_file = run_dir / "metrics.json"
    if not metrics_file.exists():
        raise HTTPException(status_code=404, detail="Metrics not available.")

    with open(metrics_file, "r") as f:
        return json.load(f)


@router.get("/runs/{run_id}/predictions")
def get_run_predictions(
    run_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    machine_id: Optional[str] = None,
    snr: Optional[str] = None,
    actual_label: Optional[int] = None,
    predicted_label: Optional[int] = None,
    correct_only: Optional[bool] = None,
    search: Optional[str] = None,
    threshold: float = 0.5,
):
    run_dir = _get_run_dir(run_id)
    csv_file = run_dir / "test_predictions.csv"
    if not csv_file.exists():
        raise HTTPException(status_code=404, detail="Predictions file not found.")

    df = pd.read_csv(csv_file)
    df["pred"] = (df["prob"] >= threshold).astype(int)
    df["correct"] = (df["label"] == df["pred"])

    # Filtering
    if machine_id:
        df = df[df["machine_id"] == machine_id]
    if snr:
        df = df[df["snr"] == snr]
    if actual_label is not None:
        df = df[df["label"] == actual_label]
    if predicted_label is not None:
        df = df[df["pred"] == predicted_label]
    if correct_only is not None:
        df = df[df["correct"] == correct_only]
    if search:
        s = search.lower()
        df = df[
            df["machine_id"].str.lower().str.contains(s) |
            df["snr"].str.lower().str.contains(s)
        ]

    total_records = len(df)
    total_pages = (total_records + page_size - 1) // page_size if total_records > 0 else 1

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_df = df.iloc[start_idx:end_idx]

    records = page_df.to_dict(orient="records")

    return {
        "run_id": run_id,
        "page": page,
        "page_size": page_size,
        "total_records": total_records,
        "total_pages": total_pages,
        "threshold_used": threshold,
        "records": records,
    }


@router.get("/runs/{run_id}/predictions/export")
def export_predictions_csv(run_id: str):
    run_dir = _get_run_dir(run_id)
    csv_file = run_dir / "test_predictions.csv"
    if not csv_file.exists():
        raise HTTPException(status_code=404, detail="Predictions file not found.")
    return FileResponse(
        path=str(csv_file),
        filename=f"test_predictions_{run_id}.csv",
        media_type="text/csv"
    )


@router.get("/runs/{run_id}/curves/roc")
def get_roc_curve(run_id: str):
    run_dir = _get_run_dir(run_id)
    f = run_dir / "roc_curve.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="ROC curve data not found.")
    with open(f, "r") as fp:
        return json.load(fp)


@router.get("/runs/{run_id}/curves/precision-recall")
def get_pr_curve(run_id: str):
    run_dir = _get_run_dir(run_id)
    f = run_dir / "pr_curve.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="PR curve data not found.")
    with open(f, "r") as fp:
        return json.load(fp)


@router.get("/runs/{run_id}/breakdown/machine")
def get_machine_breakdown(run_id: str):
    run_dir = _get_run_dir(run_id)
    f = run_dir / "machine_breakdown.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="Machine breakdown not found.")
    with open(f, "r") as fp:
        return json.load(fp)


@router.get("/runs/{run_id}/breakdown/snr")
def get_snr_breakdown(run_id: str):
    run_dir = _get_run_dir(run_id)
    f = run_dir / "snr_breakdown.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="SNR breakdown not found.")
    with open(f, "r") as fp:
        return json.load(fp)


@router.get("/runs/{run_id}/breakdown/machine-snr")
def get_machine_snr_matrix(run_id: str):
    run_dir = _get_run_dir(run_id)
    f = run_dir / "machine_snr_matrix.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="Machine x SNR matrix not found.")
    with open(f, "r") as fp:
        return json.load(fp)


@router.get("/runs/{run_id}/training-history")
def get_training_history(run_id: str):
    run_dir = _get_run_dir(run_id)
    f = run_dir / "training_history.json"
    if not f.exists():
        return {"training_occurred": False, "history": []}
    with open(f, "r") as fp:
        return {"training_occurred": True, "history": json.load(fp)}


@router.get("/runs/{run_id}/reports")
def get_diagnostic_reports(run_id: str):
    run_dir = _get_run_dir(run_id)
    f = run_dir / "end_to_end_reports.json"
    if not f.exists():
        return {"reports": []}
    with open(f, "r") as fp:
        return {"reports": json.load(fp)}


@router.get("/runs/{run_id}/artifacts")
def list_run_artifacts(run_id: str):
    run_dir = _get_run_dir(run_id)
    artifacts = []
    for item in run_dir.rglob("*"):
        if item.is_file():
            rel = item.relative_to(run_dir)
            artifacts.append({
                "name": str(rel),
                "size_bytes": item.stat().st_size,
                "path": str(item),
            })
    return {"run_id": run_id, "artifacts": artifacts}


@router.get("/runs/{run_id}/artifacts/{artifact_name:path}")
def download_run_artifact(run_id: str, artifact_name: str):
    run_dir = _get_run_dir(run_id)
    file_path = (run_dir / artifact_name).resolve()

    # Prevent path traversal
    if not str(file_path).startswith(str(run_dir.resolve())):
        raise HTTPException(status_code=400, detail="Path traversal attempt detected.")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Artifact '{artifact_name}' not found.")

    return FileResponse(path=str(file_path), filename=file_path.name)


@router.get("/runs/{run_id}/report/html", response_class=HTMLResponse)
def get_html_report(run_id: str):
    """Generate a clean printable HTML evaluation report for the run."""
    run_dir = _get_run_dir(run_id)
    metrics_f = run_dir / "metrics.json"
    reports_f = run_dir / "end_to_end_reports.json"

    metrics = json.load(open(metrics_f)) if metrics_f.exists() else {}
    reports = json.load(open(reports_f)) if reports_f.exists() else []

    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ML Evaluation Report - {run_id}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #1e293b; line-height: 1.6; }}
        h1 {{ color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }}
        h2 {{ color: #1e293b; margin-top: 24px; }}
        .metric-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }}
        .card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }}
        .val {{ font-size: 24px; font-weight: bold; color: #2563eb; }}
        .lbl {{ font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 4px; }}
        .report-card {{ background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 16px; }}
        .priority {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }}
        .high {{ background: #fee2e2; color: #991b1b; }}
        .medium {{ background: #fef3c7; color: #92400e; }}
        .low {{ background: #dcfce7; color: #166534; }}
        pre {{ background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-size: 13px; }}
    </style>
</head>
<body>
    <h1>End-to-End ML Evaluation & Diagnostic Report</h1>
    <p><strong>Run ID:</strong> {run_id} | <strong>Model:</strong> SpecOnlyModel (CRNN)</p>

    <h2>1. Executive Summary & Overall Metrics</h2>
    <div class="metric-grid">
        <div class="card"><div class="val">{metrics.get('auc', 'N/A')}</div><div class="lbl">ROC-AUC</div></div>
        <div class="card"><div class="val">{metrics.get('accuracy', 'N/A')}</div><div class="lbl">Accuracy</div></div>
        <div class="card"><div class="val">{metrics.get('precision', 'N/A')}</div><div class="lbl">Precision</div></div>
        <div class="card"><div class="val">{metrics.get('recall', 'N/A')}</div><div class="lbl">Recall (Sensitivity)</div></div>
        <div class="card"><div class="val">{metrics.get('f1_score', 'N/A')}</div><div class="lbl">F1 Score</div></div>
        <div class="card"><div class="val">{metrics.get('specificity', 'N/A')}</div><div class="lbl">Specificity</div></div>
        <div class="card"><div class="val">{metrics.get('n_samples', 'N/A')}</div><div class="lbl">Evaluated Samples</div></div>
        <div class="card"><div class="val">{metrics.get('threshold', 0.5)}</div><div class="lbl">Threshold</div></div>
    </div>

    <h2>2. Stage 4 Diagnostic Reports</h2>
    """

    for rep in reports:
        p_class = "high" if "high" in rep.get("priority", "") else ("medium" if "medium" in rep.get("priority", "") else "low")
        html_content += f"""
        <div class="report-card">
            <h3>{rep.get('case_label')}</h3>
            <p><strong>Machine:</strong> {rep.get('machine_id')} | <strong>SNR:</strong> {rep.get('snr')} | <strong>Prob:</strong> {rep.get('probability')}</p>
            <p><strong>Action:</strong> {rep.get('action')} | <span class="priority {p_class}">Priority: {rep.get('priority')}</span></p>
            <pre>{rep.get('report')}</pre>
        </div>
        """

    html_content += """
</body>
</html>
"""
    return HTMLResponse(content=html_content)
