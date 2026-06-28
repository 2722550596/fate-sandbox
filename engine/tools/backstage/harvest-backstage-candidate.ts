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
    ? "审查通过后用 record_offscreen_event 落地（lineId/actorIds/timeRange 照抄；privateSummary→summary；secretStateChanges→consequences；futureHooks→futureHooks；从 activePressurePalette 选 slot 填 pressureType/可选 pressureSlotId）。落地即清掉最旧一条后台义务。"
    : `候选 outcome=${candidate.outcome}：经审查确无可落地进展时，用 resolve_backstage_line 记录 no-change / blocked（窄结构化理由）。`;
  return [
    "backstage 候选已通过 engine 验收（ParallelLineOutput 结构合法）。",
    `- lineId: ${candidate.lineId}`,
    `- outcome: ${candidate.outcome}`,
    `- actorIds: ${candidate.actorIds.join(", ") || "(none)"}`,
    `- privateSummary: ${candidate.privateSummary}`,
    `- toneDriftRisk: ${candidate.toneDriftRisk}`,
    candidate.riskFlags.length > 0
      ? `- riskFlags: ${candidate.riskFlags.join("; ")}`
      : "- riskFlags: (none)",
    "",
    "禁区：privateSummary / secretStateChanges 不得原样展示给玩家；publicLeakCandidates 才是玩家安全投影。",
    path,
  ].join("\n");
}

export const harvestBackstageCandidateToolDefinition: DomainToolDefinition = {
  name: "harvest_backstage_candidate",
  description:
    "按 run_id 从 director 的持久 session 取回裸候选并过 engine 验收，返回结构合法的 ParallelLineOutput 供审查后落地。\n\n" +
    "【使用边界】\n" +
    "- run_parallel_line 异步起 director 后，隔轮（约 10-20s）用其返回的 run_id 调本工具；engine 自动定位 session、抽取候选、做结构校验\n" +
    "- run 尚未产出候选 / run_id 不存在会报错：稍后重试或核对 run_id\n" +
    "- 验收失败（非法 JSON / 缺字段）会报错：重开 director 或修正后重试\n" +
    "流程：run_parallel_line（异步）→ 隔轮 harvest_backstage_candidate(run_id) 验收 → 审查 → record_offscreen_event / resolve_backstage_line 落地清账。\n\n" +
    "禁区：\n" +
    "- 跳过验收直接落地未经结构校验的候选\n" +
    "- 把 privateSummary 原样展示给玩家\n" +
    "- 本工具不落地、不改 canonical state；落地用 record_offscreen_event / resolve_backstage_line",
  parameters: Type.Object({
    run_id: Type.String({
      description:
        "run_parallel_line 返回的 run_id（如 bl-tingen-nightwatch-001）；engine 按它定位该 director 的持久 session 并取回裸候选",
    }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    harvestBackstageCandidateTool(params, ctx.sessionManager),
};
