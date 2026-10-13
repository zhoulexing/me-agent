"""Metrics retain coverage instead of summing overlapping SDK aggregates."""

from models import Evidence


def metrics(turns: list[Evidence]) -> dict:
    events = [e for t in turns for e in t.events]
    results = [e for e in events if e.kind == "result" and not e.payload.get("parent_tool_use_id")]
    output = {
        "tool_calls": sum(e.kind == "tool_use" for e in events),
        "sdk_results": len(results),
        "input_tokens": None,
        "output_tokens": None,
        "cache_read_input_tokens": None,
        "cache_creation_input_tokens": None,
        "total_input_tokens": None,
        "sdk_total_cost_usd": None,
        "usage_coverage": "unknown",
    }
    # One aggregate per query only: retries/background continuations have ambiguous overlap.
    if turns and all(
        len([e for e in t.events if e.kind == "result" and not e.payload.get("parent_tool_use_id")]) == 1
        for t in turns
    ):
        usages = [r.payload.get("usage") for r in results]
        fields = ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
        known = True
        for field in fields:
            values = [u.get(field) if isinstance(u, dict) else None for u in usages]
            if all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in values):
                output[field] = sum(values)
            else:
                known = False
        output["usage_coverage"] = "single_result_per_query" if known else "partial"
        input_fields = ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
        if all(output[field] is not None for field in input_fields):
            output["total_input_tokens"] = sum(output[field] for field in input_fields)
        costs = [r.payload.get("total_cost_usd") for r in results]
        if all(isinstance(cost, (int, float)) and not isinstance(cost, bool) and cost >= 0 for cost in costs):
            output["sdk_total_cost_usd"] = sum(costs)
    output["model_usage_records"] = [
        r.payload["model_usage"] for r in results if r.payload.get("model_usage")
    ]
    return output
