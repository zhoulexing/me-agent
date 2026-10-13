"""Freeze experiment inputs and self-test fixture snapshots."""

import hashlib

from config import digest, inside
from version import __version__


def read_fixtures(config, targets, fixture_roots):
    snapshots = {}
    for name, target in targets.items():
        if target.kind == "fixture":
            root = fixture_roots.get(name) or inside(config.project, target.fixtures)
            files, total = {}, 0
            for path in sorted(root.rglob("*")):
                relative = str(path.relative_to(root))
                safe_path = inside(root, relative)
                if not safe_path.is_file():
                    continue
                size = safe_path.stat().st_size
                total += size
                if size > 10_000_000 or total > 50_000_000 or len(files) >= 1000:
                    raise ValueError("fixture snapshot exceeds file or total size budget")
                files[relative] = safe_path.read_bytes()
            snapshots[name] = files
    return snapshots


def fixture_hashes(snapshots):
    return {
        name: {path: hashlib.sha256(data).hexdigest() for path, data in files.items()}
        for name, files in snapshots.items()
    }


def manifest_for(experiment, suite, cases, targets, snapshots):
    case_values = [c.model_dump(mode="json") for c in cases]
    return {
        "schema_version": 1,
        "runner_version": __version__,
        "experiment": experiment.model_dump(),
        "suite": suite.model_dump(),
        "cases": case_values,
        "suite_fingerprint": digest({"suite": suite.model_dump(), "cases": case_values}),
        "targets": {k: v.model_dump() for k, v in targets.items()},
        "fixture_hashes": fixture_hashes(snapshots),
        "grading_version": "deterministic-v1",
        "limitations": [
            "fixture mode validates only the evaluator",
            "YBA notify is background input; outbound/state/artifact exports are unavailable",
            "YBA revision is declared, not verified by the current API",
        ],
    }
