"""Public report operations shared by CLI and service."""

from reports.compare import compare
from reports.html import write_html
from reports.json import build_report
from reports.summary import summarize
from storage import Repository
from storage.files import write_json

__all__ = ["compare", "summarize", "write_report"]


def write_report(repo: Repository, experiment_id: str):
    experiment = repo.get(experiment_id)
    results = repo.results(experiment_id)
    summary = summarize(results)
    synthetic = any(t["kind"] == "fixture" for t in experiment["manifest"]["targets"].values())
    planned = (
        len(experiment["manifest"]["cases"])
        * len(experiment["manifest"]["experiment"]["variants"])
        * experiment["manifest"]["experiment"]["repetitions"]
    )
    report = build_report(experiment_id, experiment, results, summary, synthetic, planned)
    root = repo.root / "experiments" / experiment_id
    write_json(root / "report.json", report)
    return write_html(root, experiment_id, experiment, results, summary, synthetic, planned)
