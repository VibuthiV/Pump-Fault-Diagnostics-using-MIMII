"""
Unit tests for evaluation metrics using Python unittest.
"""
import unittest
import numpy as np
import pandas as pd
from app.evaluation.metrics import (
    compute_metrics, compute_roc_curve, compute_pr_curve, compute_group_breakdown
)


class TestMetrics(unittest.TestCase):
    def test_compute_metrics_standard(self):
        labels = np.array([0, 0, 0, 1, 1, 1])
        probs = np.array([0.1, 0.2, 0.4, 0.6, 0.8, 0.9])
        m = compute_metrics(labels, probs, threshold=0.5)

        self.assertEqual(m["n_samples"], 6)
        self.assertEqual(m["auc"], 1.0)
        self.assertEqual(m["accuracy"], 1.0)
        self.assertEqual(m["precision"], 1.0)
        self.assertEqual(m["recall"], 1.0)
        self.assertEqual(m["specificity"], 1.0)
        self.assertEqual(m["confusion_matrix"]["tp"], 3)
        self.assertEqual(m["confusion_matrix"]["tn"], 3)

    def test_compute_metrics_single_class(self):
        labels = np.array([0, 0, 0, 0])
        probs = np.array([0.1, 0.2, 0.3, 0.4])
        m = compute_metrics(labels, probs)

        self.assertIsNone(m["auc"])
        self.assertEqual(m["accuracy"], 1.0)
        self.assertEqual(m["negative_count"], 4)
        self.assertEqual(m["positive_count"], 0)

    def test_roc_and_pr_curves(self):
        labels = np.array([0, 0, 1, 1])
        probs = np.array([0.1, 0.3, 0.7, 0.9])

        roc = compute_roc_curve(labels, probs)
        self.assertTrue(roc["available"])
        self.assertEqual(roc["auc"], 1.0)
        self.assertGreater(len(roc["points"]), 0)

        pr = compute_pr_curve(labels, probs)
        self.assertTrue(pr["available"])
        self.assertEqual(pr["average_precision"], 1.0)
        self.assertGreater(len(pr["points"]), 0)

    def test_group_breakdown(self):
        df = pd.DataFrame({
            "machine_id": ["id_00", "id_00", "id_02", "id_02"],
            "label": [0, 1, 0, 1],
            "prob": [0.1, 0.9, 0.2, 0.8]
        })
        bd = compute_group_breakdown(df, "machine_id")
        self.assertEqual(len(bd), 2)
        self.assertEqual(bd[0]["machine_id"], "id_00")
        self.assertEqual(bd[1]["machine_id"], "id_02")


if __name__ == "__main__":
    unittest.main()
