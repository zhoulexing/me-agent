"""Existing fixture and isolated-session checks before execution."""

from config import inside


def validate_experiment(config, experiment, cases, targets):
    for target in targets.values():
        if target.kind == "fixture":
            root = inside(config.project, target.fixtures)
            for case in cases:
                if not inside(root, f"{case.case_id}.json").is_file():
                    raise ValueError(f"missing fixture for {case.case_id}")
        elif len(target.sessions) < len(cases) * experiment.repetitions:
            raise ValueError("not enough dedicated session leases for all trials")
    leases = [(t.base_url, s.session_key) for t in targets.values() if t.kind == "yba" for s in t.sessions]
    if len(leases) != len(set(leases)):
        raise ValueError("variants must not share target session leases")
