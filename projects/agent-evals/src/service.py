"""Public operations shared by the CLI and a future management API."""

from config import EvalConfig, digest
from execution.runner import run_definition
from graders import evaluate
from models import EvalCase, Experiment, Suite, TargetConfig, Variant
from storage import Repository


def regrade(config: EvalConfig, experiment_id: str) -> str:
    repo = Repository(config.state_dir)
    manifest = repo.get(experiment_id)["manifest"]
    cases = {c["case_id"]: EvalCase.model_validate(c) for c in manifest["cases"]}
    rows = []
    for original in repo.results(experiment_id):
        grades, verdict, _ = evaluate(
            cases[original.case_id],
            original.turns,
            repo.trial_dir(original.trial_id) / "artifacts",
            original.execution_status,
            original.attribution,
        )
        rows.append(
            {"trial_id": original.trial_id, "verdict": verdict, "grades": [g.model_dump() for g in grades]}
        )
    return repo.add_regrade(
        experiment_id,
        {
            "experiment_id": experiment_id,
            "source_manifest_hash": digest(manifest),
            "grading_version": "deterministic-v1",
            "results": rows,
            "note": "Existing evidence only; no model or target was executed.",
        },
    )


async def rerun(config, trial_id, *, target_path=None, live=False, progress=None):
    """New trial from frozen input, never another attempt in a used live session."""
    repo = Repository(config.state_dir)
    trial = repo.inspect(trial_id)
    if not trial["result_path"]:
        raise ValueError("only a recorded trial can be rerun")
    manifest = repo.get(trial["experiment_id"])["manifest"]
    case = EvalCase.model_validate(next(c for c in manifest["cases"] if c["case_id"] == trial["case_id"]))
    original_variant = next(v for v in manifest["experiment"]["variants"] if v["name"] == trial["variant"])
    original_target = TargetConfig.model_validate(manifest["targets"][trial["variant"]])
    target = config.load(target_path, TargetConfig) if target_path else original_target
    if target.kind != original_target.kind:
        raise ValueError("rerun must use the original target kind")
    if target.kind == "yba" and (not live or not target_path):
        raise ValueError("live rerun requires --live and --target with a new isolated session lease")
    variant = Variant(**{**original_variant, "target": target_path or original_variant["target"]})
    experiment = Experiment(
        name=f"rerun-{trial_id}", suite=manifest["experiment"]["suite"], variants=[variant]
    )
    suite = Suite(name="rerun", purpose=manifest["suite"]["purpose"], cases=[case.case_id])
    roots, expected = {}, None
    if target.kind == "fixture" and not target_path:
        roots[variant.name] = repo.root / "experiments" / trial["experiment_id"] / "fixtures" / variant.name
        expected = {variant.name: manifest["fixture_hashes"][variant.name]}
    return await run_definition(
        config,
        experiment,
        suite,
        [case],
        {variant.name: target},
        progress,
        fixture_roots=roots,
        expected_fixture_hashes=expected,
        lineage={"source_experiment_id": trial["experiment_id"], "source_trial_id": trial_id},
    )
