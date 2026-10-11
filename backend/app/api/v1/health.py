"""
Health & Capabilities API Endpoints.
"""
import os
import torch
from pathlib import Path
from fastapi import APIRouter
from app.config import settings
from app.schemas.pipeline import HealthResponse, CapabilitiesResponse
from app.pipeline.dataset import load_manifest, validate_manifest

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def get_health():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None

    dataset_root = settings.get_dataset_root()
    manifest_exists = (dataset_root / "manifest.csv").exists() or (Path("manifest.csv").exists())
    checkpoint_exists = settings.get_checkpoint_path().exists() or Path("spec_only_checkpoint").exists() or Path("spec_only_checkpoint.pt").exists()
    groq_key_configured = bool(settings.groq_api_key and settings.groq_api_key.strip())

    return HealthResponse(
        status="ok",
        version="1.0.0",
        device=device,
        gpu_name=gpu_name,
        dataset_root_exists=manifest_exists,
        checkpoint_exists=checkpoint_exists,
        groq_key_configured=groq_key_configured,
    )


@router.get("/capabilities", response_model=CapabilitiesResponse)
def get_capabilities():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return CapabilitiesResponse(
        execution_modes=["checkpoint_only", "train_and_eval", "full_pipeline"],
        splits=["test", "val", "train"],
        default_threshold=0.5,
        device=device,
        supported_models=["SpecOnlyModel"],
    )


@router.get("/datasets")
def get_datasets():
    # Search root and settings path
    roots_to_check = [str(settings.get_dataset_root())]
    datasets = []

    for r in set(roots_to_check):
        p = Path(r).resolve()
        if (p / "manifest.csv").exists() or p.name == "manifest.csv":
            try:
                manifest_path = p / "manifest.csv" if p.is_dir() else p
                df = load_manifest(str(p if p.is_dir() else p.parent))
                val = validate_manifest(df)
                datasets.append({
                    "path": str(p),
                    "name": p.name if p.name != "." else "root",
                    "valid": val["valid"],
                    "total_samples": val["total_samples"],
                    "split_counts": val["split_counts"],
                    "machines": val["machines"],
                    "snrs": val["snrs"],
                })
            except Exception as e:
                datasets.append({"path": str(p), "name": p.name, "valid": False, "error": str(e)})

    return {"datasets": datasets}


@router.get("/checkpoints")
def get_checkpoints():
    checkpoints = []
    # Check default path, current dir, and artifacts dir
    candidates = [
        settings.get_checkpoint_path(),
        Path("spec_only_checkpoint"),
        Path("spec_only_checkpoint.pt"),
        settings.get_output_dir() / "spec_only_checkpoint.pt",
    ]

    for c in candidates:
        if c.exists():
            checkpoints.append({
                "path": str(c.resolve()),
                "filename": c.name,
                "size_bytes": c.stat().st_size if c.is_file() else 0,
                "is_dir": c.is_dir(),
                "available": True,
            })

    return {"checkpoints": checkpoints}
