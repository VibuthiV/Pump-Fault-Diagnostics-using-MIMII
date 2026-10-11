"""
API integration tests using Python unittest and FastAPI TestClient.
"""
import unittest
from fastapi.testclient import TestClient
from app.main import app


class TestAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint(self):
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("device", data)
        self.assertIn("dataset_root_exists", data)

    def test_capabilities_endpoint(self):
        res = self.client.get("/api/v1/capabilities")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("checkpoint_only", data["execution_modes"])
        self.assertIn("test", data["splits"])

    def test_validate_run_endpoint(self):
        payload = {
            "dataset_root": ".",
            "execution_mode": "checkpoint_only",
            "split": "test",
            "threshold": 0.5
        }
        res = self.client.post("/api/v1/runs/validate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("valid", data)


if __name__ == "__main__":
    unittest.main()
