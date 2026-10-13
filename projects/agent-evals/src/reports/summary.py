"""Repeated-trial metrics and explicit unknown coverage."""

import math
from collections import Counter, defaultdict


def summarize(results):
    variants = defaultdict(list)
    for result in results:
        variants[result.variant].append(result)
    summary = {}
    for name, values in variants.items():
        verdicts = Counter(r.verdict for r in values)
        cases = defaultdict(list)
        for r in values:
            cases[r.case_id].append(r)
        elapsed = sorted(r.elapsed_seconds for r in values)
        p95 = elapsed[max(0, math.ceil(len(elapsed) * 0.95) - 1)]
        known = [r.metrics.get("input_tokens") for r in values]
        total_input = [r.metrics.get("total_input_tokens") for r in values]
        costs = [r.metrics.get("sdk_total_cost_usd") for r in values]
        summary[name] = {
            "trials": len(values),
            "pass": verdicts["pass"],
            "fail": verdicts["fail"],
            "unknown": verdicts["unknown"],
            "pass_rate_all_trials": verdicts["pass"] / len(values),
            "all_repeats_pass_cases": sum(all(r.verdict == "pass" for r in rs) for rs in cases.values()),
            "case_count": len(cases),
            "at_least_one_pass_cases": sum(any(r.verdict == "pass" for r in rs) for rs in cases.values()),
            "p95_seconds": p95,
            "elapsed_seconds_total": sum(elapsed),
            "input_tokens": sum(known) if all(v is not None for v in known) else None,
            "total_input_tokens": sum(total_input) if all(v is not None for v in total_input) else None,
            "sdk_total_cost_usd": sum(costs) if all(v is not None for v in costs) else None,
            "usage_known_trials": sum(v is not None for v in known),
        }
    return summary
