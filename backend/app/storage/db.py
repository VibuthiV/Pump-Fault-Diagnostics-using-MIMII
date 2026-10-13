"""
SQLite database storage layer for persistent run history and metadata.
"""
import json
import sqlite3
from typing import Dict, List, Any, Optional
from app.config import settings


def get_db_connection():
    db_path = settings.get_db_path()
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS runs (
                run_id TEXT PRIMARY KEY,
                created_at TEXT,
                completed_at TEXT,
                status TEXT,
                execution_mode TEXT,
                dataset_split TEXT,
                device TEXT,
                duration_seconds REAL,
                metrics_json TEXT,
                config_json TEXT,
                error_message TEXT
            )
        """)
    conn.close()


def save_run_record(
    run_id: str,
    status: str,
    config: Dict[str, Any],
    created_at: str,
    completed_at: Optional[str] = None,
    execution_mode: Optional[str] = None,
    dataset_split: Optional[str] = None,
    device: Optional[str] = None,
    duration_seconds: Optional[float] = None,
    metrics: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None
):
    conn = get_db_connection()
    with conn:
        conn.execute("""
            INSERT OR REPLACE INTO runs (
                run_id, created_at, completed_at, status, execution_mode,
                dataset_split, device, duration_seconds, metrics_json,
                config_json, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            run_id,
            created_at,
            completed_at,
            status,
            execution_mode or config.get("execution_mode", "checkpoint_only"),
            dataset_split or config.get("split", "test"),
            device,
            duration_seconds,
            json.dumps(metrics) if metrics else None,
            json.dumps(config) if config else None,
            error_message
        ))
    conn.close()


def get_run_record(run_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None

    res = dict(row)
    if res.get("metrics_json"):
        res["metrics"] = json.loads(res["metrics_json"])
    if res.get("config_json"):
        res["config"] = json.loads(res["config_json"])
    return res


def list_run_records(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM runs ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset))
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        item = dict(r)
        if item.get("metrics_json"):
            item["metrics"] = json.loads(item["metrics_json"])
        if item.get("config_json"):
            item["config"] = json.loads(item["config_json"])
        result.append(item)
    return result


def delete_run_record(run_id: str) -> bool:
    conn = get_db_connection()
    with conn:
        cursor = conn.execute("DELETE FROM runs WHERE run_id = ?", (run_id,))
    conn.close()
    return cursor.rowcount > 0
