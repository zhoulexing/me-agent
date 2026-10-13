"""One trial lifecycle; all target interaction crosses an adapter boundary."""

import asyncio
import time

from adapters.base import TargetError
from evidence.usage import metrics
from graders import evaluate
from models import EvalCase, Evidence, TargetConfig, TrialResult
from storage import Repository


class TrialCancelled(Exception):
    pass


class ToolBudgetExceeded(Exception):
    pass


async def execute(
    *,
    target,
    target_config: TargetConfig,
    case: EvalCase,
    variant: str,
    model: str,
    repetition: int,
    trial_id: str,
    experiment_id: str,
    repo: Repository,
) -> TrialResult:
    started = time.monotonic()
    deadline = started + case.limits.timeout_seconds
    turns: list[Evidence] = []
    run_id = None
    current = None
    submission_attempted = False
    execution_status, error, attribution, cleanup = "finished", "", "", "not_needed"
    trial_dir = repo.trial_dir(trial_id)

    def check():
        if repo.cancelled(experiment_id):
            raise TrialCancelled()
        if time.monotonic() >= deadline:
            raise TimeoutError()

    async def bounded(awaitable):
        return await asyncio.wait_for(awaitable, max(0.001, deadline - time.monotonic()))

    try:
        for index, turn in enumerate(case.turns):
            check()
            current, run_id = None, None
            submission_attempted = True
            run_id = await bounded(target.submit(case, turn, index, f"{trial_id}-{index}", model))
            repo.checkpoint(trial_id, {"active_run_id": run_id, "turns": [t.model_dump() for t in turns]})
            while True:
                check()
                current = await bounded(target.poll(run_id, trial_dir / "artifacts" / str(index)))
                repo.checkpoint(
                    trial_id, {"active_run_id": run_id, "turns": [t.model_dump() for t in [*turns, current]]}
                )
                observed = metrics([*turns, current])
                if observed["tool_calls"] > case.limits.max_tool_calls:
                    raise ToolBudgetExceeded()
                token_limit = case.limits.max_input_tokens
                if (
                    token_limit
                    and observed["total_input_tokens"] is not None
                    and observed["total_input_tokens"] > token_limit
                ):
                    raise ToolBudgetExceeded()
                if current.status != "running":
                    turns.append(current)
                    current = None
                    break
                await bounded(asyncio.sleep(target_config.poll_seconds))
            if turns[-1].status != "completed":
                break
    except (TrialCancelled, asyncio.CancelledError):
        execution_status, error, attribution = "cancelled", "evaluation cancelled", "runner"
    except TimeoutError:
        execution_status, error, attribution = "timeout", "trial deadline exceeded", "undetermined"
    except ToolBudgetExceeded:
        execution_status, error, attribution = (
            "execution_error",
            "observed execution budget exceeded",
            "agent",
        )
    except TargetError as exc:
        execution_status, error, attribution = "execution_error", str(exc), "target_or_protocol"
    except Exception as exc:
        execution_status, error, attribution = (
            "execution_error",
            f"worker error: {type(exc).__name__}",
            "runner",
        )
    finally:
        if current is not None:
            turns.append(current)
        if execution_status != "finished" and submission_attempted:
            if run_id:
                try:
                    cleanup = await asyncio.wait_for(target.cancel(run_id), 5)
                except Exception as exc:
                    cleanup = f"cancel unconfirmed: {type(exc).__name__}"
            else:
                cleanup = "submission uncertain: no run ID; verify target manually before reusing environment"
        try:
            await asyncio.wait_for(target.close(), 5)
        except Exception:
            cleanup += "; adapter close failed"
    grades, verdict, measured = evaluate(case, turns, trial_dir / "artifacts", execution_status, attribution)
    return TrialResult(
        trial_id=trial_id,
        case_id=case.case_id,
        variant=variant,
        repetition=repetition,
        mode=target_config.kind,
        execution_status=execution_status,
        verdict=verdict,
        attribution=attribution,
        grades=grades,
        turns=turns,
        error=error,
        cleanup=cleanup,
        elapsed_seconds=round(time.monotonic() - started, 4),
        metrics=measured,
    )
