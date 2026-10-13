"""Single-host bounded execution. A target session is leased to one trial only."""

import asyncio
import sqlite3

from adapters.registry import create_target
from config import EvalConfig, inside
from environments.prepared import lease_key
from execution.manifest import fixture_hashes, manifest_for, read_fixtures
from execution.worker import execute
from models import TrialResult
from storage import Repository
from storage.files import write_json


async def run_experiment(config: EvalConfig, experiment_path: str, progress=None) -> str:
    experiment, suite, cases, targets = config.experiment(experiment_path)
    return await run_definition(config, experiment, suite, cases, targets, progress)


async def run_definition(
    config,
    experiment,
    suite,
    cases,
    targets,
    progress=None,
    *,
    fixture_roots=None,
    lineage=None,
    expected_fixture_hashes=None,
):
    repo = Repository(config.state_dir)
    snapshots = read_fixtures(config, targets, fixture_roots or {})
    if expected_fixture_hashes is not None and fixture_hashes(snapshots) != expected_fixture_hashes:
        raise ValueError("frozen fixture snapshot was modified; rerun refused")
    manifest = manifest_for(experiment, suite, cases, targets, snapshots)
    if lineage:
        manifest["lineage"] = lineage
    experiment_id = repo.create(experiment.name, manifest)
    roots = {}
    for name, files in snapshots.items():
        root = repo.root / "experiments" / experiment_id / "fixtures" / name
        for path, data in files.items():
            dest = inside(root, path)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            dest.chmod(0o600)
        roots[name] = root
    semaphore = asyncio.Semaphore(experiment.concurrency)
    variant_indices = {v.name: 0 for v in experiment.variants}
    jobs = []

    async def run_one(trial_id, case, variant, repetition, lease_index):
        async with semaphore:
            target_config = targets[variant.name]
            target = None
            try:
                if repo.cancelled(experiment_id):
                    raise asyncio.CancelledError()
                repo.claim(trial_id, lease_key(target_config, lease_index))
                target = create_target(
                    config.project, target_config, lease_index, fixture_root=roots.get(variant.name)
                )
                description = await target.describe()
                write_json(repo.trial_dir(trial_id) / "target.json", description)
                result = await execute(
                    target=target,
                    target_config=target_config,
                    case=case,
                    variant=variant.name,
                    model=variant.model,
                    repetition=repetition,
                    trial_id=trial_id,
                    experiment_id=experiment_id,
                    repo=repo,
                )
                target = None  # execute owns adapter cleanup
            except (Exception, asyncio.CancelledError) as exc:
                cancelled = isinstance(exc, asyncio.CancelledError)
                error = (
                    "test session has already been leased"
                    if isinstance(exc, sqlite3.IntegrityError)
                    else type(exc).__name__
                )
                result = TrialResult(
                    trial_id=trial_id,
                    case_id=case.case_id,
                    variant=variant.name,
                    repetition=repetition,
                    mode=target_config.kind,
                    execution_status="cancelled" if cancelled else "execution_error",
                    verdict="unknown",
                    attribution="environment",
                    error=error,
                )
            finally:
                if target is not None:
                    try:
                        await asyncio.wait_for(target.close(), 5)
                    except Exception:
                        result.cleanup = "adapter close unconfirmed"
            repo.finish_trial(result)
            if progress:
                progress(
                    {
                        "experiment_id": experiment_id,
                        "trial_id": trial_id,
                        "case": case.case_id,
                        "variant": variant.name,
                        "verdict": result.verdict,
                    }
                )

    # Interleave variants for each case/repetition rather than running all baseline trials first.
    for repetition in range(experiment.repetitions):
        for case in cases:
            for variant in experiment.variants:
                index = variant_indices[variant.name]
                variant_indices[variant.name] += 1
                trial_id = repo.add_trial(experiment_id, case.case_id, variant.name, repetition)
                jobs.append((trial_id, case, variant, repetition, index))
    try:
        await asyncio.gather(*(run_one(*job) for job in jobs))
    except BaseException:
        repo.cancel(experiment_id)
        repo.finish(experiment_id, "interrupted")
        raise
    repo.finish(experiment_id, "cancelled" if repo.cancelled(experiment_id) else "finished")
    from reports import write_report

    write_report(repo, experiment_id)
    return experiment_id
