"""Synthetic evidence for runner/grader self-tests, never an Agent benchmark."""

import hashlib
import json
import shutil
from pathlib import Path

from adapters.base import TargetError
from config import inside
from models import Artifact, EvalCase, Evidence, Turn


class FixtureTarget:
    def __init__(self, root: Path):
        self.root = root
        self.runs: dict[str, dict] = {}

    async def describe(self):
        return {"kind": "fixture", "synthetic": True, "label": "评测器自检，非 Agent 效果"}

    async def submit(self, case: EvalCase, turn: Turn, index: int, key: str, model: str):
        path = inside(self.root, f"{case.case_id}.json")
        data = json.loads(path.read_text())
        if data.get("synthetic") is not True:
            raise TargetError("fixture must explicitly declare synthetic=true")
        try:
            self.runs[key] = data["turns"][index]
        except (KeyError, IndexError) as exc:
            raise TargetError("fixture does not cover this turn") from exc
        return key

    async def poll(self, run_id: str, artifact_dir: Path):
        data = self.runs[run_id]
        evidence = Evidence.model_validate({**data["evidence"], "target_run_id": run_id})
        artifact_dir.mkdir(parents=True, exist_ok=True)
        for spec in data.get("files", []):
            source = inside(self.root, spec["source"])
            if source.stat().st_size > 10_000_000:
                raise TargetError("fixture artifact exceeds 10 MB")
            name = spec["name"]
            if Path(name).name != name or name in {".", ".."}:
                raise TargetError("artifact name must be a basename")
            dest = inside(artifact_dir, name)
            shutil.copyfile(source, dest)
            evidence.artifacts.append(
                Artifact(
                    name=name,
                    path=name,
                    size=dest.stat().st_size,
                    sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),
                )
            )
        for event in evidence.events:
            event.target_run_id = run_id
            event.source = "synthetic_fixture"
        return evidence

    async def cancel(self, run_id: str):
        return "cancelled_synthetic"

    async def close(self):
        pass
