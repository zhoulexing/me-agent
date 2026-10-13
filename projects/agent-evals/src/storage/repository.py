"""Single-host experiment storage. Evidence is immutable; regrades are appended."""

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from config import inside
from models import TrialResult
from storage.files import write_json


def now():
    return datetime.now(timezone.utc).isoformat()


class Repository:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = root / "evaluations.sqlite3"
        with self.connect() as conn:
            conn.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS experiments (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL,
                    cancel_requested INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL, finished_at TEXT, manifest TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS trials (
                    id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES experiments(id),
                    case_id TEXT NOT NULL, variant TEXT NOT NULL, repetition INTEGER NOT NULL,
                    status TEXT NOT NULL, result_path TEXT,
                    UNIQUE(experiment_id, case_id, variant, repetition));
                CREATE TABLE IF NOT EXISTS regrades (
                    id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES experiments(id),
                    created_at TEXT NOT NULL, result_path TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS session_leases (
                    target_key TEXT PRIMARY KEY, trial_id TEXT NOT NULL REFERENCES trials(id));
            """)

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.path, timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def create(self, name: str, manifest: dict) -> str:
        experiment_id = uuid.uuid4().hex
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO experiments(id,name,status,created_at,manifest) VALUES (?,?,?,?,?)",
                (experiment_id, name, "running", now(), json.dumps(manifest, ensure_ascii=False)),
            )
        write_json(self.root / "experiments" / experiment_id / "manifest.json", manifest)
        return experiment_id

    def add_trial(self, experiment_id: str, case_id: str, variant: str, repetition: int) -> str:
        trial_id = uuid.uuid4().hex
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO trials VALUES (?,?,?,?,?,?,NULL)",
                (trial_id, experiment_id, case_id, variant, repetition, "queued"),
            )
        return trial_id

    def claim(self, trial_id: str, lease_key: str | None = None):
        with self.connect() as conn:
            result = conn.execute(
                "UPDATE trials SET status='running' WHERE id=? AND status='queued'", (trial_id,)
            )
            if result.rowcount != 1:
                raise ValueError("trial already claimed")
            if lease_key:
                # Never reuse an externally mutated test session, including after cancellation.
                conn.execute("INSERT INTO session_leases VALUES (?,?)", (lease_key, trial_id))

    def trial_dir(self, trial_id: str) -> Path:
        path = inside(self.root / "trials", trial_id)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def finish_trial(self, result: TrialResult):
        path = self.trial_dir(result.trial_id) / "result.json"
        if path.exists():
            raise ValueError("trial evidence is immutable")
        write_json(path, result.model_dump(mode="json"))
        with self.connect() as conn:
            conn.execute(
                "UPDATE trials SET status=?,result_path=? WHERE id=?",
                (result.execution_status, str(path.relative_to(self.root)), result.trial_id),
            )

    def checkpoint(self, trial_id: str, evidence):
        write_json(self.trial_dir(trial_id) / "checkpoint.json", evidence)

    def cancelled(self, experiment_id: str) -> bool:
        return bool(self.get(experiment_id)["cancel_requested"])

    def cancel(self, experiment_id: str):
        self.get(experiment_id)
        with self.connect() as conn:
            conn.execute(
                "UPDATE experiments SET cancel_requested=1 WHERE id=? AND status='running'", (experiment_id,)
            )

    def finish(self, experiment_id: str, status: str):
        with self.connect() as conn:
            conn.execute(
                "UPDATE experiments SET status=?,finished_at=? WHERE id=?", (status, now(), experiment_id)
            )

    def get(self, experiment_id: str) -> dict:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM experiments WHERE id=?", (experiment_id,)).fetchone()
        if row is None:
            raise ValueError("unknown experiment")
        data = dict(row)
        data["manifest"] = json.loads(data["manifest"])
        return data

    def results(self, experiment_id: str) -> list[TrialResult]:
        self.get(experiment_id)
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT result_path FROM trials WHERE experiment_id=? ORDER BY rowid", (experiment_id,)
            ).fetchall()
        return [
            TrialResult.model_validate_json(inside(self.root, r["result_path"]).read_text())
            for r in rows
            if r["result_path"]
        ]

    def inspect(self, trial_id: str) -> dict:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM trials WHERE id=?", (trial_id,)).fetchone()
        if row is None:
            raise ValueError("unknown trial")
        data = dict(row)
        if data["result_path"]:
            data["result"] = json.loads(inside(self.root, data["result_path"]).read_text())
        return data

    def add_regrade(self, experiment_id: str, data: dict) -> str:
        regrade_id = uuid.uuid4().hex
        path = self.root / "regrades" / f"{regrade_id}.json"
        write_json(path, data)
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO regrades VALUES (?,?,?,?)",
                (regrade_id, experiment_id, now(), str(path.relative_to(self.root))),
            )
        return regrade_id
