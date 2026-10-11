"""
Dataset loading — extracted from the notebook.
Preserves SpecDataset, eval_collate, manifest loading, and path rewriting.
"""
import os
import glob
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from torch.utils.data import Dataset

STATUS_TO_IDX = {"normal": 0, "abnormal": 1}
IDX_TO_STATUS = {0: "normal", 1: "abnormal"}

SEED = 42


def load_manifest(dataset_root: str, old_prefix: str = "/kaggle/working/mimii_pump_precomputed") -> pd.DataFrame:
    """Load the dataset manifest CSV and rewrite paths to the local dataset root.

    Args:
        dataset_root: Path to the directory containing manifest.csv
        old_prefix: The prefix in the CSV paths to replace (Kaggle-specific)

    Returns:
        DataFrame with corrected paths
    """
    dataset_root = str(Path(dataset_root).resolve())

    # Try direct path first
    direct_path = os.path.join(dataset_root, "manifest.csv")
    if os.path.exists(direct_path):
        manifest_path, root = direct_path, dataset_root
    else:
        # Search recursively
        matches = glob.glob(os.path.join(dataset_root, "**", "manifest.csv"), recursive=True)
        if not matches:
            raise FileNotFoundError(f"manifest.csv not found under {dataset_root}")
        manifest_path, root = matches[0], os.path.dirname(matches[0])

    df = pd.read_csv(manifest_path)

    # Rewrite paths from Kaggle to local
    for col in ["path_1d", "path_2d"]:
        if col in df.columns:
            df[col] = df[col].str.replace(old_prefix, root, regex=False)

    return df


def validate_manifest(df: pd.DataFrame, check_files: bool = False) -> dict:
    """Validate manifest structure and optionally check that all feature files exist.

    Returns:
        dict with validation results including any missing files
    """
    required_cols = {"path_1d", "path_2d", "split", "status", "snr", "machine_id"}
    missing_cols = required_cols - set(df.columns)
    if missing_cols:
        return {"valid": False, "error": f"Missing columns: {missing_cols}"}

    splits = df["split"].unique().tolist()
    statuses = df["status"].unique().tolist()
    machines = df["machine_id"].unique().tolist()
    snrs = df["snr"].unique().tolist()

    split_counts = df["split"].value_counts().to_dict()
    status_counts = df["status"].value_counts().to_dict()

    result = {
        "valid": True,
        "total_samples": len(df),
        "splits": splits,
        "split_counts": split_counts,
        "statuses": statuses,
        "status_counts": status_counts,
        "machines": machines,
        "snrs": snrs,
        "missing_files": [],
    }

    if check_files:
        missing = []
        for _, row in df.iterrows():
            for col in ["path_1d", "path_2d"]:
                if not os.path.exists(row[col]):
                    missing.append(row[col])
        result["missing_files"] = missing
        if missing:
            result["valid"] = False
            result["error"] = f"{len(missing)} feature files not found for {len(df)} manifest rows"

    return result


def random_crop_spec(log_mel_2d, waveform_1d, crop_samples, hop_len, rng):
    """Random crop for training augmentation — from notebook."""
    total = waveform_1d.shape[-1]
    if crop_samples >= total:
        return log_mel_2d
    start_sample = int(rng.integers(0, total - crop_samples + 1))
    crop_frames = crop_samples // hop_len
    start_frame = start_sample // hop_len
    return log_mel_2d[..., start_frame:start_frame + crop_frames]


class SpecDataset(Dataset):
    """Spectrogram dataset — from notebook."""

    def __init__(self, df: pd.DataFrame, split: str, config: dict, train: bool):
        self.rows = df[df["split"] == split].reset_index(drop=True)
        self.config = config
        self.train = train
        self.rng = np.random.default_rng(SEED)

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        row = self.rows.iloc[i]
        waveform_1d = np.load(row["path_1d"])
        log_mel_2d = np.load(row["path_2d"])

        if self.train:
            spec = random_crop_spec(
                log_mel_2d, waveform_1d,
                self.config["train_crop_samples"],
                self.config["hop_len"], self.rng
            )
            target_frames = self.config["train_crop_samples"] // self.config["hop_len"]
            if spec.shape[-1] < target_frames:
                spec = np.pad(spec, ((0, 0), (0, 0), (0, target_frames - spec.shape[-1])), mode="edge")
            elif spec.shape[-1] > target_frames:
                spec = spec[..., :target_frames]
        else:
            spec = log_mel_2d

        status = STATUS_TO_IDX[row["status"]]
        return {
            "spec": torch.from_numpy(np.ascontiguousarray(spec.astype(np.float32))),
            "status": torch.tensor(status, dtype=torch.long),
            "snr": row["snr"],
            "machine_id": row["machine_id"],
        }


def eval_collate(batch):
    """Collate function for variable-length spectrograms during evaluation — from notebook."""
    if isinstance(batch, dict):
        spec = batch["spec"]
        status = batch["status"]
        if spec.ndim == 3:
            batch["spec"] = spec.unsqueeze(0)
        if status.ndim == 0:
            batch["status"] = status.unsqueeze(0)
        if isinstance(batch["snr"], str):
            batch["snr"] = [batch["snr"]]
        if isinstance(batch["machine_id"], str):
            batch["machine_id"] = [batch["machine_id"]]
        return batch

    max_len = max(b["spec"].shape[-1] for b in batch)
    specs = []
    for b in batch:
        s = b["spec"]
        if s.shape[-1] < max_len:
            s = F.pad(s, (0, max_len - s.shape[-1]), mode="replicate")
        specs.append(s)
    return {
        "spec": torch.stack(specs),
        "status": torch.stack([b["status"] for b in batch]),
        "snr": [b["snr"] for b in batch],
        "machine_id": [b["machine_id"] for b in batch],
    }
