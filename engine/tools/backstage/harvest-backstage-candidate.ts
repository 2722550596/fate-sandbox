/**
 * harvest_backstage_candidate 领域工具（引擎直接异步导演 slice A，回程防火墙）。
 *
 * GM 只给 run_parallel_line 返回的 run_id；engine 自己按 run_id 定位该 director 的
 * 持久 session（取最新一份），抽出最后一条 assistant 文本（裸候选），再过 engine 的
 * TypeBox 验收（parseParallelLineOutput：容前后噪音、定位首尾大括号、严格校验结构），
 * 返回已验收的 ParallelLineOutput 供 GM 审查后落地。无需 GM 手动读 session / 用 inspect。
 *
 * 不自动落地：审查后由 GM 决定走 record_offscreen_event（progress/escalation）
 * 或 resolve_backstage_line（no-change/blocked）。「不审查就落地」是禁区。
 */

import type { ParallelLineOutput } from "../../core/state/state.ts";
import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { clearPendingHarvestByRun } from "../../core/backstage/backstage-pending.ts";
import { readBackstageCandidateRaw } from "../../core/backstage/backstage-session-read.ts";
import { parseParallelLineOutput } from "../../core/backstage/parallel-line-output-schema.ts";
import { assertNonEmptyString, isRecord } from "../../core/utils/typebox-validation.ts";
import { runDomainEventTool } from "../system/domain-tool-runner.ts";

/** sessionDir 仅供测试注入临时夹具目录；生产走默认 BACKSTAGE_SESSION_DIR。 */
export function harvestBackstageCandidateTool(
  params: unknown,
  sessionManager: unknown,
  sessionDir?: string,
): ToolResult {
  if (!isRecord(params)) {
    throw new Error("harvest_backstage_candidate 参数必须是对象。");
  }
  const runId = assertNonEmptyString(params["run_id"], "run_id");
  // 读+验收在前（可能报错）；只有取回成功才清掉该 run 的 pending 标记。
  const raw = readBackstageCandidateRaw(runId, sessionDir);
  const candidate = parseParallelLineOutput(raw);
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      clearPendingHarvestByRun(draft, runId);
      return { candidate, runId };
    },
    details: ({ candidate: c, runId: r }) => ({ candidate: c, runId: r }),
    message: ({ candidate: c }) => buildGuidance(c),
  });
}

function buildGuidance(candidate: ParallelLineOutput): string {
  const lands = candidate.outcome === "progress" || candidate.outcome === "escalation";
  const path = lands
    ? "审查通过后，用 record_offscreen_event 落地到幕后状态里（把候选中的信息对应填进去：summary 写事件概述、consequences 写后果、futureHooks 写后续线索）。落地会自动清掉一条后台待办提醒。"
    : `候选判定为 outcome=${candidate.outcome}：经审查确认确实没有值得落地的新进展时，用 resolve_backstage_line 记录理由（no-change/blocked）。`;
  return [
    "后台候选已通过结构验收，可以审查了。",
    `- lineId: ${candidate.lineId}`,
    `- outcome: ${candidate.outcome}`,
    `- actorIds: ${candidate.actorIds.join(", ") || "(none)"}`,
    `- privateSummary: ${candidate.privateSummary}`,
    `- toneDriftRisk: ${candidate.toneDriftRisk}`,
    candidate.riskFlags.length > 0
      ? `- riskFlags: ${candidate.riskFlags.join("; ")}`
      : "- riskFlags: (none)",
    "",
    "注意：候选中的 privateSummary 和 secretStateChanges 不得直接展示给玩家——只有 publicLeakCandidates 中的内容才是玩家可以安全感知到的投影。",
    path,
  ].join("\n");
}

export const harvestBackstageCandidateToolDefinition: DomainToolDefinition = {
  name: "harvest_backstage_candidate",
  description:
    "取回后台导演产出的候选取回审查。\n\nrun_parallel_line 启动后台导演后，导演会在后台异步运行。隔一轮后用 run_parallel_line 返回的 run_id 调这个工具，引擎会自动定位到导演的 session、取出它的输出、并且做结构验收。\n\n【什么时候用】\n- 调完 run_parallel_line 后隔一轮（约 10-20 秒），用返回的 run_id 取候选\n\n操作流程：\n1. run_parallel_line（异步启动）\n2. → 隔一轮调 harvest_backstage_candidate(run_id) 验收\n3. → 审查输出 → 有进展：record_offscreen_event 落地 / 没进展：resolve_backstage_line 清账\n\n常见错误：\n- run 还没产出候选或 run_id 不对：稍后重试或核对 run_id\n- 验收失败（JSON 格式或字段不完整）：重新启动导演或修正后重试\n\n【不要这样做】\n- 不经过验收就直接落地未经结构校验的候选\n- 把候选中的 privateSummary 原样展示给玩家\n- 这个工具只取回内容，不做落地——落地用 record_offscreen_event 或 resolve_backstage_line",
  parameters: Type.Object({
    run_id: Type.String({
      description:
        "run_parallel_line 返回的 run_id（如 bl-tingen-nightwatch-001）；engine 按它定位该 director 的持久 session 并取回裸候选",
    }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    harvestBackstageCandidateTool(params, ctx.sessionManager),
};
