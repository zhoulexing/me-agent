// YBA WorkflowBuilder-compatible source. The caller supplies business observations.
export const workflow = {
  "name": "Jev 驱动的成交下降诊断",
  "description": "根据当前证据动态选择补查、核验、追问或结束",
  "trigger": { "type": "event", "source": "demo", "events": ["sales_drop_analysis"] },
  "capabilities": { "request": {} },
  "timeout_seconds": 60
};

const ACTIONS = {
  check_checkout: "检查结算和支付失败数据",
  check_inventory: "检查缺货及商品下架数据",
  check_campaign: "检查近期活动与价格变化",
  verify_payment: "独立核验支付失败信号",
  ask_user: "缺少可用数据，向用户补充询问",
  finish: "现有证据足以形成结论，结束诊断"
};

function candidates(visited, evidenceCount) {
  const offered = ["check_checkout", "check_inventory", "check_campaign"]
    .filter((name) => !visited.includes(name));
  if (visited.includes("check_checkout") && !visited.includes("verify_payment")) {
    offered.push("verify_payment");
  }
  if (evidenceCount >= 3) offered.push("finish");
  offered.push("ask_user");
  return offered;
}

async function decide(ctx, goal, evidence, visited, offered, remaining) {
  const criteria = Object.fromEntries(offered.map((name) => [name, ACTIONS[name]]));
  const response = await ctx.request({
    method: "POST",
    url: "https://api.typesafe.ai/v1/systemone",
    credential_ref: "typesafe",
    body: {
      model: "jev-1.13.0",
      state: { goal, evidence, completed_checks: visited, remaining_steps: remaining },
      questions: {
        next_step: {
          type: "choice",
          instructions: "Choose the single next step that most improves the diagnosis. Use only the offered actions. Verify a suspected payment failure before concluding it is the cause.",
          criteria
        },
        enough_evidence: {
          type: "noul",
          instructions: "Is the available evidence sufficient to give the user a supported diagnosis now?"
        }
      }
    }
  });
  if (response.status !== 200) throw new Error(`Jev HTTP ${response.status}`);
  const answers = response.body?.answers;
  const choice = answers?.next_step;
  const probabilities = choice?.probabilities;
  const sufficient = answers?.enough_evidence?.noul;
  if (
    choice?.type !== "choice" ||
    !offered.includes(choice.choice) ||
    !Number.isFinite(choice.confidence) ||
    choice.confidence < 0 || choice.confidence > 1 ||
    !probabilities ||
    Object.keys(probabilities).length !== offered.length ||
    offered.some((name) => !Number.isFinite(probabilities[name]) || probabilities[name] < 0 || probabilities[name] > 1) ||
    Math.abs(offered.reduce((sum, name) => sum + probabilities[name], 0) - 1) > 0.02 ||
    probabilities[choice.choice] < Math.max(...offered.map((name) => probabilities[name])) - 0.000001 ||
    answers?.enough_evidence?.type !== "noul" ||
    !Number.isFinite(sufficient) || sufficient < 0 || sufficient > 1
  ) {
    throw new Error("Jev response is invalid for the offered action space");
  }
  return { action: choice.choice, confidence: choice.confidence, sufficient };
}

export async function handle(trigger, ctx) {
  const goal = String(trigger.goal || "").trim();
  const evidence = Array.isArray(trigger.initial_evidence)
    ? trigger.initial_evidence.map((item) => ({ ...item }))
    : [];
  if (!goal || evidence.length === 0) {
    return { status: "needs_input", reason: "缺少目标或初始证据", trace: [] };
  }

  const visited = [];
  const trace = [];
  const nodeResults = trigger.node_results || {};
  const maxSteps = 4;

  for (let step = 0; step < maxSteps; step += 1) {
    const offered = candidates(visited, evidence.length);
    const decision = await decide(ctx, goal, evidence, visited, offered, maxSteps - step);
    trace.push({ step: step + 1, offered, ...decision });

    if (decision.confidence < 0.6) {
      return { status: "needs_review", reason: "下一步选择不确定", evidence, trace };
    }
    if (decision.action === "ask_user") {
      return { status: "needs_input", reason: "需要用户补充信息", evidence, trace };
    }
    if (decision.action === "finish") {
      if (decision.sufficient < 0.8) {
        return { status: "needs_review", reason: "结束条件未满足", evidence, trace };
      }
      return { status: "done", evidence, trace };
    }

    const result = nodeResults[decision.action];
    if (!result || typeof result !== "object") {
      return { status: "blocked", reason: `节点 ${decision.action} 没有返回证据`, evidence, trace };
    }
    evidence.push({ check: decision.action, ...result });
    visited.push(decision.action);
  }

  return { status: "budget_exhausted", evidence, trace };
}
