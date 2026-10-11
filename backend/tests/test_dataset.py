"""
Unit tests for dataset manifest validation using Python unittest.
"""
import unittest
import pandas as pd
from app.pipeline.dataset import validate_manifest


class TestDataset(unittest.TestCase):
    def test_validate_manifest_valid(self):
        df = pd.DataFrame({
            "path_1d": ["/path/1.npy", "/path/2.npy"],
            "path_2d": ["/path/1_2d.npy", "/path/2_2d.npy"],
            "split": ["train", "test"],
            "status": ["normal", "abnormal"],
            "snr": ["pump_6db", "pump_0db"],
            "machine_id": ["id_00", "id_02"]
        })
        res = validate_manifest(df, check_files=False)
        self.assertTrue(res["valid"])
        self.assertEqual(res["total_samples"], 2)
        self.assertIn("train", res["split_counts"])
        self.assertIn("test", res["split_counts"])

    def test_validate_manifest_missing_column(self):
        df = pd.DataFrame({
            "path_1d": ["/path/1.npy"],
            "split": ["train"]
        })
        res = validate_manifest(df, check_files=False)
        self.assertFalse(res["valid"])
        self.assertIn("Missing columns", res["error"])


if __name__ == "__main__":
    unittest.main()
