"""Escaped static HTML with no script execution."""

import html
import json


def write_html(root, experiment_id, experiment, results, summary, synthetic, planned):
    def esc(value):
        return html.escape(str(value), quote=True)

    rows = []
    for r in results:
        details = "\n".join(f"{g.grader_id}: {g.verdict} — {g.reason}" for g in r.grades)
        rows.append(
            f"<tr><td>{esc(r.case_id)}</td><td>{esc(r.variant)}</td><td>{r.repetition + 1}</td>"
            f'<td class="{r.verdict}">{r.verdict}</td><td>{r.elapsed_seconds:.2f}s</td>'
            f"<td><details><summary>证据与判分</summary><pre>{esc(details)}</pre>"
            f"<p>{esc(r.error)} {esc(r.cleanup)}</p>"
            f'<a href="../../trials/{r.trial_id}/result.json">原始结果 JSON</a></details></td></tr>'
        )
    label = "模拟数据自检 · 不能作为 Agent 效果结论" if synthetic else "YBA 执行 · 缺失证据需复核"
    document = f"""<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'">
<title>agent-evals · {esc(experiment["name"])}</title>
<style>body{{font:15px system-ui;max-width:1200px;margin:40px auto;padding:0 24px;color:#18302d;background:#f7f9f8}}
table{{border-collapse:collapse;width:100%;background:white}}td,th{{padding:14px;border-bottom:1px solid #ddd;text-align:left}}
pre{{white-space:pre-wrap;overflow-wrap:anywhere}}.pass{{color:#087c52}}.fail{{color:#bb322f}}.unknown{{color:#906000}}</style>
<h1>{esc(experiment["name"])}</h1><p>{label}</p><p>{esc(experiment_id)} · {esc(experiment["status"])}</p>
<p>已记录 {len(results)} / {planned} 次试验；以下通过率仅统计已记录结果，未完成实验不可作为最终结论。</p>
<pre>{esc(json.dumps(summary, ensure_ascii=False, indent=2))}</pre>
<table><thead><tr><th>用例</th><th>版本</th><th>重复</th><th>结论</th><th>耗时</th><th>详情</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table></html>"""
    (root / "report.html").write_text(document, encoding="utf-8")
    return root / "report.html"
