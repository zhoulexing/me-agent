"""Standalone command line. Run from any directory with --project."""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from pydantic import ValidationError

from config import EvalConfig
from execution.runner import run_experiment
from reports import compare, write_report
from service import regrade, rerun
from storage import Repository


def output(value, *, stream=sys.stdout):
    print(json.dumps(value, ensure_ascii=False, indent=2), file=stream)


def main(argv=None):
    parser = argparse.ArgumentParser(prog="agent-evals")
    parser.add_argument("--project", type=Path, default=Path.cwd())
    parser.add_argument("--state-dir", type=Path)
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate", help="validate a suite or an experiment without execution")
    validate.add_argument("path")
    validate.add_argument("--experiment", action="store_true")
    run = commands.add_parser("run", help="run a declared experiment")
    run.add_argument("path")
    run.add_argument(
        "--live", action="store_true", help="explicitly enable calls to declared isolated YBA sessions"
    )
    retry = commands.add_parser(
        "rerun", help="new trial using frozen input; live rerun needs a fresh target session"
    )
    retry.add_argument("id")
    retry.add_argument("--target")
    retry.add_argument("--live", action="store_true")
    for command in ("inspect", "report", "cancel", "regrade"):
        commands.add_parser(command).add_argument("id")
    diff = commands.add_parser("compare")
    diff.add_argument("baseline")
    diff.add_argument("candidate")
    args = parser.parse_args(argv)
    config = EvalConfig(args.project, args.state_dir)
    try:
        if args.command == "validate":
            if args.experiment:
                exp, suite, cases, targets = config.experiment(args.path)
                output(
                    {
                        "valid": True,
                        "experiment": exp.name,
                        "suite": suite.name,
                        "cases": len(cases),
                        "modes": sorted({t.kind for t in targets.values()}),
                    }
                )
            else:
                suite, cases = config.suite(args.path)
                output({"valid": True, "suite": suite.name, "cases": len(cases)})
        elif args.command in {"run", "rerun"}:
            if args.command == "run":
                _, _, _, targets = config.experiment(args.path)
                if any(t.kind == "yba" for t in targets.values()) and not args.live:
                    raise ValueError(
                        "YBA notify executes and may send messages; use --live only with isolated test sessions"
                    )
                experiment_id = asyncio.run(
                    run_experiment(config, args.path, lambda p: output(p, stream=sys.stderr))
                )
            else:
                experiment_id = asyncio.run(
                    rerun(
                        config,
                        args.id,
                        target_path=args.target,
                        live=args.live,
                        progress=lambda p: output(p, stream=sys.stderr),
                    )
                )
            repo = Repository(config.state_dir)
            report = write_report(repo, experiment_id)
            results = repo.results(experiment_id)
            output(
                {
                    "experiment_id": experiment_id,
                    "report": str(report),
                    "verdicts": [r.verdict for r in results],
                }
            )
            return 0 if results and all(r.verdict == "pass" for r in results) else 1
        else:
            repo = Repository(config.state_dir)
            if args.command == "inspect":
                output(repo.inspect(args.id))
            elif args.command == "report":
                output({"report": str(write_report(repo, args.id))})
            elif args.command == "cancel":
                repo.cancel(args.id)
                output(
                    {
                        "experiment_id": args.id,
                        "cancel_requested": repo.cancelled(args.id),
                        "note": "Running target cancellation may be unsupported; check trial cleanup status.",
                    }
                )
            elif args.command == "regrade":
                output({"regrade_id": regrade(config, args.id)})
            elif args.command == "compare":
                output(compare(repo, args.baseline, args.candidate))
    except ValidationError as exc:
        output(
            {
                "error": "invalid_definition",
                "details": [
                    {"field": list(e["loc"]), "message": e["msg"]} for e in exc.errors(include_input=False)
                ],
            },
            stream=sys.stderr,
        )
        return 2
    except (ValueError, OSError) as exc:
        output({"error": type(exc).__name__, "message": str(exc)}, stream=sys.stderr)
        return 2
    except KeyboardInterrupt:
        output(
            {"error": "interrupted", "note": "Inspect trial cleanup before reusing target sessions."},
            stream=sys.stderr,
        )
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
