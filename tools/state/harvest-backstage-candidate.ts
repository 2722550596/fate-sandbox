/**
 * harvest_backstage_candidate 领域工具（pi-actors 生产化 slice A，回程防火墙）。
 *
 * 异步 faction-director 跑完后，GM 从该 director 的持久 session 取回最后一条
 * assistant 文本（裸候选）。本工具把这段原始文本过 engine 的 TypeBox 验收
 * （parseParallelLineOutput：容前后噪音、定位首尾大括号、严格校验结构），
 * 返回已验收的 ParallelLineOutput 供 GM 审查后落地。
 *
 * 不自动落地：审查后由 GM 决定走 record_offscreen_event（progress/escalation）
 * 或 resolve_backstage_line（no-change/blocked）。「不审查就落地」是禁区。
 */

import type { ParallelLineOutput } from "../../engine/core/state.ts";
import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { parseParallelLineOutput } from "../../engine/core/parallel-line-output-schema.ts";
import { assertNonEmptyString, isRecord } from "../../engine/core/typebox-validation.ts";
import { textResult } from "../runtime/tool-result.ts";

export function harvestBackstageCandidateTool(params: unknown): ToolResult {
  if (!isRecord(params)) {
    throw new Error("harvest_backstage_candidate 参数必须是对象。");
  }
  const raw = assertNonEmptyString(params["raw"], "raw");
  const candidate = parseParallelLineOutput(raw);
  return textResult(buildGuidance(candidate), { candidate });
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
    candidate.riskFlags.length > 0 ? `- riskFlags: ${candidate.riskFlags.join("; ")}` : "- riskFlags: (none)",
    "",
    "禁区：privateSummary / secretStateChanges 不得原样展示给玩家；publicLeakCandidates 才是玩家安全投影。",
    path,
  ].join("\n");
}

export const harvestBackstageCandidateToolDefinition: FateToolDefinition = {
  name: "harvest_backstage_candidate",
  description:
    "把异步 faction-director（pi-actors）返回的裸候选文本过 engine 验收，返回结构合法的 ParallelLineOutput 供审查后落地。\n\n" +
    "【使用边界】\n" +
    "- faction-director 异步跑完，从其持久 session 取回最后一条 assistant 文本后，先过本工具验收\n" +
    "- 验收失败（非法 JSON / 缺字段）会报错：重开 director 或修正后重试\n" +
    "流程：spawn faction_director（异步）→ 隔轮取回裸文本 → harvest_backstage_candidate 验收 → 审查 → record_offscreen_event / resolve_backstage_line 落地清账。\n\n" +
    "禁区：\n" +
    "- 跳过验收直接落地未经结构校验的候选\n" +
    "- 把 privateSummary 原样展示给玩家\n" +
    "- 本工具不落地、不改 state；落地用 record_offscreen_event / resolve_backstage_line",
  parameters: Type.Object({
    raw: Type.String({
      description: "faction-director 持久 session 里最后一条 assistant 消息的原始文本（裸候选 JSON，可含前后噪音）",
    }),
  }),
  execute: async (_toolCallId, params) => harvestBackstageCandidateTool(params),
};
