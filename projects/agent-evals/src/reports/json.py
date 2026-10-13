"""The existing machine-readable report contract."""


def build_report(experiment_id, experiment, results, summary, synthetic, planned):
    return {
        "experiment_id": experiment_id,
        "status": experiment["status"],
        "synthetic": synthetic,
        "summary": summary,
        "gate": "selftest_only" if synthetic else "review",
        "planned_trials": planned,
        "finished_trials": len(results),
        "complete": experiment["status"] == "finished" and len(results) == planned,
        "limitations": experiment["manifest"]["limitations"],
    }
