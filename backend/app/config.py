"""
Backend configuration loaded from environment variables and .env file.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Dataset
    dataset_root: str = Field(
        default="./data/mimii_pump_precomputed",
        description="Root directory containing manifest.csv and .npy feature files"
    )

    # Artifacts
    output_dir: str = Field(
        default="./artifacts",
        description="Directory for pipeline outputs"
    )

    # Checkpoint
    checkpoint_path: str = Field(
        default="./artifacts/spec_only_checkpoint.pt",
        description="Path to existing model checkpoint"
    )

    # Groq API
    groq_api_key: str = Field(
        default="",
        description="Groq API key for diagnostic report generation"
    )

    # Server
    backend_host: str = Field(default="0.0.0.0")
    backend_port: int = Field(default=8000)
    frontend_url: str = Field(default="http://localhost:5173")

    # Database
    db_path: str = Field(
        default="./artifacts/runs.db",
        description="SQLite database path for run history"
    )

    model_config = {
        "env_file": str(Path(__file__).resolve().parents[2] / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @staticmethod
    def _project_root() -> Path:
        return Path(__file__).resolve().parents[2]

    def _resolve_path(self, value: str) -> Path:
        path = Path(value)
        return (self._project_root() / path).resolve() if not path.is_absolute() else path.resolve()

    def get_dataset_root(self) -> Path:
        return self._resolve_path(self.dataset_root)

    def get_output_dir(self) -> Path:
        p = self._resolve_path(self.output_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    def get_checkpoint_path(self) -> Path:
        configured = self._resolve_path(self.checkpoint_path)
        if configured.exists():
            return configured

        project_root = self._project_root()
        candidates = [
            project_root / "artifacts" / "spec_only_checkpoint.pt",
            project_root / "spec_only_checkpoint.pt",
        ]
        return next((candidate for candidate in candidates if candidate.exists()), configured)

    def get_runs_dir(self) -> Path:
        p = self.get_output_dir() / "runs"
        p.mkdir(parents=True, exist_ok=True)
        return p

    def get_db_path(self) -> Path:
        p = self._resolve_path(self.db_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
