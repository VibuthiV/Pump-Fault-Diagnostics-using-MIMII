"""
End-to-End Pipeline Runner module.
Extracted and refactored from end-to-end-pipeline-refined.ipynb.
Callable via run_pipeline(config, progress_callback).
"""
import json
import time

from typing import Dict, Any, Callable, Optional
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, WeightedRandomSampler
from sklearn.metrics import roc_auc_score

from app.config import settings
from app.pipeline.model import SpecOnlyModel
from app.pipeline.dataset import load_manifest, validate_manifest, SpecDataset, eval_collate, STATUS_TO_IDX
from app.evaluation.metrics import (
    compute_metrics, compute_roc_curve, compute_pr_curve,
    compute_group_breakdown, compute_matrix_breakdown
)
from app.reporting.rag_agent import run_stage3_and_stage4


def run_pipeline(
    config: Dict[str, Any],
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    cancel_check: Optional[Callable[[], bool]] = None
) -> Dict[str, Any]:
    """Execute the end-to-end ML evaluation and diagnostic pipeline.

    Args:
        config: Dictionary containing pipeline options:
            - run_id: Unique string identifier for the run
            - dataset_root: Path to directory containing manifest.csv
            - execution_mode: 'checkpoint_only' | 'train_and_eval' | 'full_pipeline'
            - split: Dataset split to evaluate ('test', 'val', 'train')
            - quick_demo: bool (5 epochs vs 20 epochs)
            - skip_training_if_checkpoint_exists: bool
            - threshold: float (default 0.5)
            - enable_groq: bool
            - groq_api_key: str
            - epochs, batch_size, lr, weight_decay, seed
        progress_callback: Function called with status updates:
            {"stage": str, "stage_num": int, "total_stages": int, "message": str, "progress": float, ...}
        cancel_check: Callable returning True if job cancellation was requested.

    Returns:
        Dict containing metrics, prediction summary, reports, and artifact paths.
    """
    start_time = time.time()

    run_id = config.get("run_id", f"run_{int(start_time)}")
    run_dir = settings.get_runs_dir() / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    requested_root = str(config.get("dataset_root") or "").strip()
    if requested_root in {"", ".", "./", settings.dataset_root}:
        dataset_root = str(settings.get_dataset_root())
    else:
        dataset_root = requested_root
    execution_mode = config.get("execution_mode", "checkpoint_only")
    eval_split = config.get("split", "test")
    quick_demo = config.get("quick_demo", True)
    skip_training_if_checkpoint_exists = config.get("skip_training_if_checkpoint_exists", True)
    threshold = config.get("threshold", 0.5)
    enable_groq = config.get("enable_groq", True)
    groq_api_key = config.get("groq_api_key") or settings.groq_api_key

    # Model Hyperparameters
    seed = config.get("seed", 42)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

    model_config = {
        "hop_len": 160,
        "n_mels": 128,
        "train_crop_samples": 48000,
        "batch_size": config.get("batch_size", 32),
        "num_workers": 0,  # Cross-platform compatibility for Windows background tasks
        "epochs": config.get("epochs", 5 if quick_demo else 20),
        "lr": config.get("lr", 2.5e-4),
        "weight_decay": config.get("weight_decay", 1e-4),
        "warmup_epochs": config.get("warmup_epochs", 2 if quick_demo else 8),
        "decay_every": 2,
        "decay_factor": 0.9,
        "grad_clip": 5.0,
        "embed_dim_spec": 96,
        "fused_dim": 128,
    }

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def notify(stage: str, stage_num: int, total_stages: int, message: str, progress: float = 0.0, **extra):
        if cancel_check and cancel_check():
            raise InterruptedError("Run cancelled by user.")
        if progress_callback:
            progress_callback({
                "stage": stage,
                "stage_num": stage_num,
                "total_stages": total_stages,
                "message": message,
                "progress": round(progress, 3),
                "elapsed_seconds": round(time.time() - start_time, 1),
                **extra
            })

    total_stages = 7

    # =========================================================================
    # STAGE 1: Dataset Validation & Loading
    # =========================================================================
    notify("Stage 1: Dataset Loading", 1, total_stages, f"Loading manifest from {dataset_root}...", progress=0.1)

    manifest_df = load_manifest(dataset_root)
    validation = validate_manifest(manifest_df, check_files=True)
    if not validation["valid"]:
        raise ValueError(f"Dataset validation failed: {validation.get('error')}")

    notify("Stage 1: Dataset Loading", 1, total_stages,
           f"Manifest loaded successfully ({len(manifest_df)} total samples across {len(validation['splits'])} splits).",
           progress=0.15)

    # =========================================================================
    # STAGE 2: Model Setup / Training
    # =========================================================================
    checkpoint_dir = run_dir / "checkpoints"
    checkpoint_dir.mkdir(exist_ok=True)
    run_checkpoint_path = checkpoint_dir / "spec_only_checkpoint.pt"

    # Default fallback to existing user checkpoint if specified
    shared_checkpoint_path = settings.get_checkpoint_path()

    model = SpecOnlyModel(model_config).to(device)

    training_history = []
    should_train = execution_mode in ["train_and_eval", "full_pipeline"]

    if should_train:
        # Check if reuse checkpoint option is enabled
        if skip_training_if_checkpoint_exists and shared_checkpoint_path.exists():
            notify("Stage 2: Model Setup", 2, total_stages,
                   f"Found existing checkpoint at {shared_checkpoint_path}. Reusing existing checkpoint.",
                   progress=0.3)
            model.load_state_dict(torch.load(shared_checkpoint_path, map_location=device))
        else:
            notify("Stage 2: Training", 2, total_stages,
                   f"Starting model training ({model_config['epochs']} epochs, device={device})...",
                   progress=0.2)

            train_ds = SpecDataset(manifest_df, "train", model_config, train=True)
            val_ds = SpecDataset(manifest_df, "val", model_config, train=False)

            train_status = train_ds.rows["status"].map(STATUS_TO_IDX).values
            class_counts = np.bincount(train_status)
            sample_weights = (1.0 / class_counts)[train_status]
            sampler = WeightedRandomSampler(sample_weights, len(sample_weights), replacement=True)

            train_loader = DataLoader(train_ds, batch_size=model_config["batch_size"], sampler=sampler,
                                      num_workers=model_config["num_workers"], drop_last=True)
            val_loader = DataLoader(val_ds, batch_size=model_config["batch_size"], shuffle=False,
                                     num_workers=model_config["num_workers"], collate_fn=eval_collate)

            optimizer = torch.optim.Adam(model.parameters(), lr=model_config["lr"], weight_decay=model_config["weight_decay"])

            def lr_lambda(epoch):
                if epoch < model_config["warmup_epochs"]:
                    return (epoch + 1) / model_config["warmup_epochs"]
                return model_config["decay_factor"] ** ((epoch - model_config["warmup_epochs"]) // model_config["decay_every"])

            scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)
            scaler = torch.amp.GradScaler("cuda", enabled=(device.type == "cuda"))
            criterion = nn.CrossEntropyLoss()

            def run_epoch(loader, train_mode):
                model.train() if train_mode else model.eval()
                probs_all, labels_all = [], []
                with torch.set_grad_enabled(train_mode):
                    for batch in loader:
                        spec, status = batch["spec"].to(device), batch["status"].to(device)
                        with torch.amp.autocast("cuda", enabled=(device.type == "cuda")):
                            logits = model(spec)
                            loss = criterion(logits, status)
                        if train_mode:
                            optimizer.zero_grad()
                            scaler.scale(loss).backward()
                            scaler.unscale_(optimizer)
                            torch.nn.utils.clip_grad_norm_(model.parameters(), model_config["grad_clip"])
                            scaler.step(optimizer)
                            scaler.update()
                        probs = F.softmax(logits, dim=1)[:, 1].detach().cpu().numpy()
                        probs_all.extend(probs.tolist())
                        labels_all.extend(status.detach().cpu().numpy().tolist())
                auc = roc_auc_score(labels_all, probs_all) if len(set(labels_all)) > 1 else float("nan")
                return auc

            best_auc, best_state = -1.0, None
            for epoch in range(model_config["epochs"]):
                train_auc = run_epoch(train_loader, train_mode=True)
                val_auc = run_epoch(val_loader, train_mode=False)
                scheduler.step()

                epoch_info = {
                    "epoch": epoch + 1,
                    "total_epochs": model_config["epochs"],
                    "train_auc": round(float(train_auc), 4) if not np.isnan(train_auc) else None,
                    "val_auc": round(float(val_auc), 4) if not np.isnan(val_auc) else None,
                }
                training_history.append(epoch_info)

                p_stage = 0.2 + (0.2 * ((epoch + 1) / model_config["epochs"]))
                notify("Stage 2: Training", 2, total_stages,
                       f"Epoch {epoch+1}/{model_config['epochs']} | Train AUC: {train_auc:.4f}, Val AUC: {val_auc:.4f}",
                       progress=p_stage, epoch_info=epoch_info)

                if not np.isnan(val_auc) and val_auc > best_auc:
                    best_auc = val_auc
                    best_state = {k: v.clone() for k, v in model.state_dict().items()}

            if best_state is not None:
                model.load_state_dict(best_state)

            torch.save(model.state_dict(), run_checkpoint_path)
            notify("Stage 2: Training", 2, total_stages,
                   f"Training complete. Best val AUC: {best_auc:.4f}. Checkpoint saved.",
                   progress=0.4)
    else:
        # Checkpoint evaluation mode
        notify("Stage 2: Model Setup", 2, total_stages, f"Loading checkpoint for evaluation...", progress=0.3)
        chk_path = shared_checkpoint_path if shared_checkpoint_path.exists() else run_checkpoint_path
        if not chk_path.exists():
            raise FileNotFoundError(
                f"Model checkpoint not found at {chk_path}. Please provide a checkpoint or select train mode."
            )
        model.load_state_dict(torch.load(chk_path, map_location=device))

    # Save model checkpoint artifact
    torch.save(model.state_dict(), run_checkpoint_path)

    # =========================================================================
    # STAGE 3: Test Evaluation
    # =========================================================================
    notify("Stage 3: Evaluation", 3, total_stages, f"Evaluating model on split '{eval_split}'...", progress=0.45)

    eval_df = manifest_df[manifest_df["split"] == eval_split].reset_index(drop=True)
    if len(eval_df) == 0:
        raise ValueError(f"No samples found in manifest for split '{eval_split}'.")

    test_ds = SpecDataset(manifest_df, eval_split, model_config, train=False)
    test_loader = DataLoader(test_ds, batch_size=model_config["batch_size"], shuffle=False,
                              num_workers=model_config["num_workers"], collate_fn=eval_collate)

    model.eval()
    records = []
    with torch.no_grad():
        for batch_idx, batch in enumerate(test_loader):
            spec = batch["spec"].to(device)
            status = batch["status"].numpy()
            with torch.amp.autocast("cuda", enabled=(device.type == "cuda")):
                logits = model(spec)
            probs = F.softmax(logits, dim=1)[:, 1].cpu().numpy()
            for i in range(len(status)):
                records.append({
                    "snr": batch["snr"][i],
                    "machine_id": batch["machine_id"][i],
                    "label": int(status[i]),
                    "prob": float(probs[i]),
                })

            p_eval = 0.45 + (0.15 * ((batch_idx + 1) / len(test_loader)))
            if batch_idx % 5 == 0 or batch_idx == len(test_loader) - 1:
                notify("Stage 3: Evaluation", 3, total_stages,
                       f"Evaluated {len(records)}/{len(eval_df)} samples...", progress=p_eval)

    results_df = pd.DataFrame(records)
    results_df["pred"] = (results_df["prob"] >= threshold).astype(int)

    # Save test_predictions.csv
    csv_path = run_dir / "test_predictions.csv"
    results_df.to_csv(csv_path, index=False)

    # =========================================================================
    # STAGE 4: Metrics & Visualizations Computation
    # =========================================================================
    notify("Stage 4: Metric Computation", 4, total_stages, "Computing overall & group metrics...", progress=0.65)

    metrics = compute_metrics(results_df["label"].values, results_df["prob"].values, threshold=threshold)
    roc_data = compute_roc_curve(results_df["label"].values, results_df["prob"].values)
    pr_data = compute_pr_curve(results_df["label"].values, results_df["prob"].values)
    machine_breakdown = compute_group_breakdown(results_df, "machine_id", threshold=threshold)
    snr_breakdown = compute_group_breakdown(results_df, "snr", threshold=threshold)
    matrix_breakdown = compute_matrix_breakdown(results_df, threshold=threshold)

    # Save json metrics artifacts
    with open(run_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    with open(run_dir / "roc_curve.json", "w") as f:
        json.dump(roc_data, f, indent=2)
    with open(run_dir / "pr_curve.json", "w") as f:
        json.dump(pr_data, f, indent=2)
    with open(run_dir / "machine_breakdown.json", "w") as f:
        json.dump(machine_breakdown, f, indent=2)
    with open(run_dir / "snr_breakdown.json", "w") as f:
        json.dump(snr_breakdown, f, indent=2)
    with open(run_dir / "machine_snr_matrix.json", "w") as f:
        json.dump(matrix_breakdown, f, indent=2)

    if training_history:
        with open(run_dir / "training_history.json", "w") as f:
            json.dump(training_history, f, indent=2)

    notify("Stage 4: Metric Computation", 4, total_stages,
           f"Evaluation metrics computed: AUC={metrics['auc']}, ACC={metrics['accuracy']}.", progress=0.75)

    # =========================================================================
    # STAGE 5 & 6: Diagnostic Explanations (RAG + Groq API)
    # =========================================================================
    notify("Stage 5: Representative Cases", 5, total_stages, "Selecting representative cases...", progress=0.8)

    reports = []
    if enable_groq:
        notify("Stage 6: Diagnostic Reports", 6, total_stages, "Generating RAG & LLM diagnostic reports...", progress=0.85)
        reports = run_stage3_and_stage4(
            df=results_df,
            groq_api_key=groq_api_key if enable_groq else "",
            log_callback=lambda msg: notify("Stage 6: Diagnostic Reports", 6, total_stages, msg, progress=0.9)
        )

    with open(run_dir / "end_to_end_reports.json", "w") as f:
        json.dump(reports, f, indent=2)

    # =========================================================================
    # STAGE 7: Finalizing & Report Export
    # =========================================================================
    notify("Stage 7: Finalizing", 7, total_stages, "Generating final report artifacts...", progress=0.95)

    summary_report = {
        "run_id": run_id,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(start_time)),
        "duration_seconds": round(time.time() - start_time, 2),
        "device": str(device),
        "config": config,
        "metrics": metrics,
        "machine_breakdown": machine_breakdown,
        "snr_breakdown": snr_breakdown,
        "reports": reports,
    }

    with open(run_dir / "summary_report.json", "w") as f:
        json.dump(summary_report, f, indent=2)

    with open(run_dir / "run_config.json", "w") as f:
        json.dump(config, f, indent=2)

    notify("Completed", 7, total_stages, "Run completed successfully!", progress=1.0)

    return {
        "run_id": run_id,
        "run_dir": str(run_dir),
        "duration_seconds": summary_report["duration_seconds"],
        "metrics": metrics,
        "roc_curve": roc_data,
        "pr_curve": pr_data,
        "machine_breakdown": machine_breakdown,
        "snr_breakdown": snr_breakdown,
        "machine_snr_matrix": matrix_breakdown,
        "training_history": training_history,
        "reports": reports,
        "predictions_count": len(results_df),
    }
