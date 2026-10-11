"""
Pydantic API schemas for request validation and response models.
"""
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class RunValidateRequest(BaseModel):
    dataset_root: str = Field(default=".")
    execution_mode: str = Field(default="checkpoint_only", description="checkpoint_only | train_and_eval | full_pipeline")
    split: str = Field(default="test", description="test | val | train")
    quick_demo: bool = Field(default=True)
    skip_training_if_checkpoint_exists: bool = Field(default=True)
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    enable_groq: bool = Field(default=True)
    groq_api_key: Optional[str] = None
    epochs: Optional[int] = Field(default=None, ge=1, le=100)
    batch_size: Optional[int] = Field(default=None, ge=1, le=256)
    lr: Optional[float] = Field(default=None, gt=0.0)
    seed: int = Field(default=42)


class RunValidateResponse(BaseModel):
    valid: bool
    warnings: List[str] = []
    error: Optional[str] = None
    dataset_info: Dict[str, Any] = {}
    checkpoint_found: bool = False
    checkpoint_path: str = ""
    groq_available: bool = False
    estimated_duration: str = "Fast (~10-30s)"


class RunCreateRequest(RunValidateRequest):
    run_name: Optional[str] = None


class RunStatusResponse(BaseModel):
    run_id: str
    status: str
    created_at: str
    completed_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    execution_mode: str
    dataset_split: str
    device: Optional[str] = None
    error_message: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    device: str
    gpu_name: Optional[str] = None
    dataset_root_exists: bool
    checkpoint_exists: bool
    groq_key_configured: bool


class CapabilitiesResponse(BaseModel):
    execution_modes: List[str] = ["checkpoint_only", "train_and_eval", "full_pipeline"]
    splits: List[str] = ["test", "val", "train"]
    default_threshold: float = 0.5
    device: str
    supported_models: List[str] = ["SpecOnlyModel"]
