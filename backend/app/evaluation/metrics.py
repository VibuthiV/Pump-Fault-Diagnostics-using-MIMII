"""
Evaluation metrics calculation module.
Computes ROC-AUC, accuracy, precision, recall, F1, specificity, confusion matrix,
ROC curve, PR curve, machine breakdown, SNR breakdown, and Machine x SNR breakdown.
"""
from typing import Dict, List, Any, Optional
import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_auc_score, accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, roc_curve, precision_recall_curve,
    average_precision_score
)


def compute_metrics(
    labels: np.ndarray,
    probs: np.ndarray,
    threshold: float = 0.5
) -> Dict[str, Any]:
    """Compute comprehensive evaluation metrics for binary classification.

    Positive class: abnormal (1)
    Negative class: normal (0)
    """
    labels = np.asarray(labels, dtype=int)
    probs = np.asarray(probs, dtype=float)
    preds = (probs >= threshold).astype(int)

    n_samples = len(labels)
    unique_labels = np.unique(labels)

    # Calculate ROC-AUC safely
    if len(unique_labels) > 1:
        auc = float(roc_auc_score(labels, probs))
    else:
        auc = None  # Undefined for single class dataset

    acc = float(accuracy_score(labels, preds))
    prec = float(precision_score(labels, preds, zero_division=0))
    rec = float(recall_score(labels, preds, zero_division=0))
    f1 = float(f1_score(labels, preds, zero_division=0))

    # Confusion matrix: [[TN, FP], [FN, TP]]
    if len(unique_labels) > 1 or (0 in unique_labels and 1 in unique_labels):
        cm = confusion_matrix(labels, preds, labels=[0, 1])
        tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])
    else:
        # Fallback if only one class is present in split
        tp = int(np.sum((labels == 1) & (preds == 1)))
        tn = int(np.sum((labels == 0) & (preds == 0)))
        fp = int(np.sum((labels == 0) & (preds == 1)))
        fn = int(np.sum((labels == 1) & (preds == 0)))

    # Specificity = TN / (TN + FP)
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0

    return {
        "n_samples": n_samples,
        "auc": round(auc, 4) if auc is not None else None,
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "specificity": round(specificity, 4),
        "threshold": threshold,
        "confusion_matrix": {
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "tp": tp,
            "total_normal": tn + fp,
            "total_abnormal": tp + fn,
        },
        "positive_count": int(np.sum(labels == 1)),
        "negative_count": int(np.sum(labels == 0)),
    }


def compute_roc_curve(labels: np.ndarray, probs: np.ndarray) -> Dict[str, Any]:
    """Calculate ROC curve data points for frontend visualization."""
    labels = np.asarray(labels, dtype=int)
    probs = np.asarray(probs, dtype=float)

    if len(np.unique(labels)) <= 1:
        return {"available": False, "points": [], "auc": None}

    fpr, tpr, thresholds = roc_curve(labels, probs)
    auc_val = float(roc_auc_score(labels, probs))

    # Downsample points if too many for fast rendering
    max_pts = 100
    if len(fpr) > max_pts:
        indices = np.linspace(0, len(fpr) - 1, max_pts, dtype=int)
        fpr = fpr[indices]
        tpr = tpr[indices]
        thresholds = thresholds[indices]

    points = [
        {
            "fpr": round(float(f), 4),
            "tpr": round(float(t), 4),
            "threshold": round(float(th), 4) if np.isfinite(th) else 1.0,
        }
        for f, t, th in zip(fpr, tpr, thresholds)
    ]

    return {"available": True, "auc": round(auc_val, 4), "points": points}


def compute_pr_curve(labels: np.ndarray, probs: np.ndarray) -> Dict[str, Any]:
    """Calculate Precision-Recall curve data points."""
    labels = np.asarray(labels, dtype=int)
    probs = np.asarray(probs, dtype=float)

    if len(np.unique(labels)) <= 1:
        return {"available": False, "points": [], "average_precision": None}

    precision, recall, thresholds = precision_recall_curve(labels, probs)
    ap = float(average_precision_score(labels, probs))

    max_pts = 100
    if len(precision) > max_pts:
        indices = np.linspace(0, len(precision) - 1, max_pts, dtype=int)
        precision = precision[indices]
        recall = recall[indices]
        # thresholds has length len(precision) - 1
        threshold_indices = np.minimum(indices, len(thresholds) - 1)
        thresholds = thresholds[threshold_indices]
    else:
        # pad thresholds to match precision/recall length
        thresholds = np.append(thresholds, [1.0])

    points = [
        {
            "precision": round(float(p), 4),
            "recall": round(float(r), 4),
            "threshold": round(float(th), 4) if np.isfinite(th) else 1.0,
        }
        for p, r, th in zip(precision, recall, thresholds)
    ]

    return {"available": True, "average_precision": round(ap, 4), "points": points}


def compute_group_breakdown(
    df: pd.DataFrame,
    group_col: str,
    threshold: float = 0.5
) -> List[Dict[str, Any]]:
    """Compute performance breakdown by group (machine_id or snr)."""
    breakdown = []
    for group_val, sub_df in df.groupby(group_col):
        metrics = compute_metrics(
            sub_df["label"].values,
            sub_df["prob"].values,
            threshold=threshold
        )
        metrics[group_col] = str(group_val)
        breakdown.append(metrics)
    return breakdown


def compute_matrix_breakdown(
    df: pd.DataFrame,
    threshold: float = 0.5
) -> Dict[str, Any]:
    """Compute Machine x SNR performance matrix."""
    machines = sorted(df["machine_id"].unique().tolist())
    snrs = sorted(df["snr"].unique().tolist())

    matrix_data = []
    for m in machines:
        row = {"machine_id": m}
        for s in snrs:
            sub_df = df[(df["machine_id"] == m) & (df["snr"] == s)]
            if len(sub_df) > 0:
                met = compute_metrics(sub_df["label"].values, sub_df["prob"].values, threshold)
                row[s] = {
                    "n_samples": len(sub_df),
                    "auc": met["auc"],
                    "accuracy": met["accuracy"],
                    "recall": met["recall"],
                    "f1_score": met["f1_score"],
                }
            else:
                row[s] = None
        matrix_data.append(row)

    return {
        "machines": machines,
        "snrs": snrs,
        "matrix": matrix_data
    }
