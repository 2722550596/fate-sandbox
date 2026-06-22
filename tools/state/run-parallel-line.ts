/**
 * run_parallel_line 领域工具（backlog #5；pi-actors 生产化 slice A）。
 *
 * GM 只给 lineId + timeWindow + 可选偏好，engine 装配 ParallelLineInput 并进一步
 * 拼成完整的 hermetic director prompt，返回【异步 spawn 指令】——不再走同步子代理。
 * 后台生成只走 pi-actors：spawn faction-director（独立进程、--no-tools、钉模型）→
 * 隔轮取回裸候选 → harvest_backstage_candidate 验收 → 审查 → 落地清账。
 */

import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import {
  BACKSTAGE_MODEL,
  BACKSTAGE_RECIPE,
  BACKSTAGE_SESSION_DIR,
} from "../../engine/core/backstage-substrate-config.ts";
import { buildBackstageDirectorPrompt } from "../../engine/core/backstage-director-prompt.ts";
import { type AssembleParallelLineInput } from "../../engine/core/parallel-line-assembler.ts";
import { hydrateStateFromSessionManager } from "../../engine/core/session-hydration.ts";
import { getState } from "../../engine/core/state-store.ts";
import { isRecord } from "../../engine/core/typebox-validation.ts";
import { textResult } from "../runtime/tool-result.ts";

/** sanitize lineId into a run-id suffix for inspectable, collision-free async runs. */
function backstageRunId(lineId: string): string {
  const slug = lineId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `bl-${slug || "line"}`;
}

export function runParallelLineTool(params: unknown, sessionManager: unknown): ToolResult {
  if (sessionManager !== undefined) {
    hydrateStateFromSessionManager(sessionManager);
  }
  const state = getState();
  const input = parseToolInput(params);
  const directorPrompt = buildBackstageDirectorPrompt(state, input);
  const runId = backstageRunId(input.lineId);
  return textResult(
    [
      "backstage 异步导演 prompt 已由 engine 装配（persona + 安全投影 + ParallelLineInput）。",
      "请【异步 spawn】一个 hermetic faction-director（不要走同步子代理）：",
      `  recipe=${BACKSTAGE_RECIPE}`,
      `  model=${BACKSTAGE_MODEL}   （钉死，勿继承 {current_model}）`,
      `  session_dir=${BACKSTAGE_SESSION_DIR}   （持久、含隐藏事实、勿入 repo）`,
      `  run_id=${runId}   （便于 inspect 巡检）`,
      "  prompt=以下完整 director prompt 全文",
      "",
      "导演跑完后：从该 session 取最后一条 assistant 文本 → harvest_backstage_candidate 验收 →",
      "审查 → record_offscreen_event（progress/escalation，落地即清义务）或 resolve_backstage_line（no-change/blocked）。",
      "子代理失败/未调用不算清账。",
      "",
      "========== DIRECTOR PROMPT (spawn 的 prompt 参数) ==========",
      directorPrompt,
    ].join("\n"),
    { directorPrompt, lineId: input.lineId, recipe: BACKSTAGE_RECIPE, model: BACKSTAGE_MODEL, runId },
  );
}

function parseToolInput(params: unknown): AssembleParallelLineInput {
  if (!isRecord(params)) {
    throw new Error("run_parallel_line 参数必须是对象。");
  }
  const lineId = requireString(params["lineId"], "lineId");
  const timeWindow = requireTimeWindow(params["timeWindow"]);
  return {
    lineId,
    timeWindow,
    currentArc: optionalString(params["currentArc"]),
    currentBeat: optionalString(params["currentBeat"]),
    preferredPressureType: optionalString(params["preferredPressureType"]),
    excludedActorIds: optionalStringArray(params["excludedActorIds"]),
    excludedPressureTypes: optionalStringArray(params["excludedPressureTypes"]),
    majorBeatEnd: optionalBoolean(params["majorBeatEnd"]),
    arcTransition: optionalBoolean(params["arcTransition"]),
    additionalKnownFacts: optionalStringArray(params["additionalKnownFacts"]),
    additionalPrivateFacts: optionalStringArray(params["additionalPrivateFacts"]),
    allowedScope: optionalStringArray(params["allowedScope"]),
    forbiddenEscalations: optionalStringArray(params["forbiddenEscalations"]),
    previousLineState: optionalString(params["previousLineState"]),
    playerSideSummary: optionalString(params["playerSideSummary"]),
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} 必须是非空字符串。`);
  }
  return value.trim();
}

function requireTimeWindow(value: unknown): { start: string; end: string } {
  if (!isRecord(value)) {
    throw new Error("timeWindow 必须是 { start, end } 对象。");
  }
  return {
    start: requireString(value["start"], "timeWindow.start"),
    end: requireString(value["end"], "timeWindow.end"),
  };
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

export const runParallelLineToolDefinition: FateToolDefinition = {
  name: "run_parallel_line",
  description:
    "由 engine 装配完整 hermetic director prompt，返回【异步 spawn 指令】。GM 只给 lineId + timeWindow + 可选偏好，engine 从 secret state / agenda / offscreenEventLog / pressure palette 补齐字段并拼出可直接作为 spawn prompt 的全文。\n\n" +
    "【使用边界】\n" +
    "- 需推进后台世界线，不想手写全部 ParallelLineInput\n" +
    "- gm-tool-policy 触发 parallel-line（跳时 >10-30min、beat 关闭、连续 2 轮无代价）\n" +
    "流程：拿 director prompt → 【异步 spawn】 faction-director（pi-actors recipe，非同步子代理）→ 隔轮从持久 session 取裸候选 → harvest_backstage_candidate 验收 → 审查 → record_offscreen_event / resolve_backstage_line 落地。\n\n" +
    "禁区：\n" +
    "- 绕过 engine 装配手写完整 ParallelLineInput / director prompt\n" +
    "- 改走同步子代理（已废弃）或让导演继承 {current_model}\n" +
    "- 把 privateFacts / privateSummary 原样写进玩家可见正文\n" +
    "- 不过 harvest_backstage_candidate 验收就落地",
  parameters: Type.Object({
    lineId: Type.String({ description: "后台线标识，如 caster-ryudou、lancer-church" }),
    timeWindow: Type.Object({
      start: Type.String({ description: "ISO UTC 起始时刻" }),
      end: Type.String({ description: "ISO UTC 结束时刻" }),
    }),
    currentArc: Type.Optional(Type.String({ description: "可选覆盖当前 arc；省略则从 storyWindow 推断" })),
    currentBeat: Type.Optional(Type.String({ description: "可选覆盖当前 beat；省略则从 storyWindow 推断" })),
    preferredPressureType: Type.Optional(Type.String({ description: "偏好压力类型；省略则由子代理自选" })),
    excludedActorIds: Type.Optional(Type.Array(Type.String(), { description: "硬排除 actor ids" })),
    excludedPressureTypes: Type.Optional(Type.Array(Type.String(), { description: "硬排除压力类型" })),
    majorBeatEnd: Type.Optional(Type.Boolean({ description: "本轮是否 beat 结束" })),
    arcTransition: Type.Optional(Type.Boolean({ description: "本轮是否 arc 转换" })),
    additionalKnownFacts: Type.Optional(Type.Array(Type.String(), { description: "追加 knownFacts" })),
    additionalPrivateFacts: Type.Optional(Type.Array(Type.String(), { description: "追加 privateFacts" })),
    allowedScope: Type.Optional(Type.Array(Type.String(), { description: "允许范围" })),
    forbiddenEscalations: Type.Optional(Type.Array(Type.String(), { description: "追加禁区（叠加 storyWindow）" })),
    previousLineState: Type.Optional(Type.String({ description: "覆盖 engine 自动拼的上一次线状态" })),
    playerSideSummary: Type.Optional(Type.String({ description: "覆盖 engine 自动拼的玩家侧摘要" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    runParallelLineTool(params, ctx.sessionManager),
};
