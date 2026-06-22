/**
 * run_parallel_line 领域工具（backlog #5）。
 *
 * GM 只需提供 lineId + timeWindow + 可选偏好，engine 自动装配
 * ParallelLineInput 并把结果用 TypeBox 验收。装配质量不再依赖
 * 主模型现编，泄密风险由 engine 过滤而非 prompt 自查。
 */

import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import {
  assembleParallelLineInput,
  type AssembleParallelLineInput,
} from "../../engine/core/parallel-line-assembler.ts";
import { hydrateStateFromSessionManager } from "../../engine/core/session-hydration.ts";
import { getState } from "../../engine/core/state-store.ts";
import { isRecord } from "../../engine/core/typebox-validation.ts";
import { textResult } from "../runtime/tool-result.ts";

export function runParallelLineTool(params: unknown, sessionManager: unknown): ToolResult {
  if (sessionManager !== undefined) {
    hydrateStateFromSessionManager(sessionManager);
  }
  const state = getState();
  const input = parseToolInput(params);
  const assembled = assembleParallelLineInput(state, input);
  const assembledJson = JSON.stringify(assembled, null, 2);
  return textResult(
    [
      "parallel-line 输入已由 engine 装配完成。",
      "请将以下 JSON 作为 task 传给 parallel-line 子代理（agentScope: project）。",
      "子代理返回后，用 record_offscreen_event 或其它领域工具落地候选结果；",
      "落地时从 activePressurePalette 里选一个 slot，把它的 pressureType（可选 slot id）填进 record_offscreen_event。",
      "",
      assembledJson,
    ].join("\n"),
    { assembledInput: assembled },
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
    "由 engine 自动装配 parallel-line 子代理输入。GM 只给 lineId + timeWindow + 可选偏好，engine 从 secret state / agenda / offscreenEventLog / pressure palette 补齐其余字段，返回可直接传给子代理的 JSON。\n\n" +
    "【使用边界】\n" +
    "- 需推进后台世界线，不想手写全部 ParallelLineInput\n" +
    "- gm-tool-policy 触发 parallel-line（跳时 >10-30min、beat 关闭、连续 2 轮无代价）\n" +
    "流程：拿 JSON → 作 task 传给 parallel-line 子代理（agentScope: project）→ 审查后用 record_offscreen_event 等工具落地。\n\n" +
    "禁区：\n" +
    "- 绕过 engine 装配手写完整 ParallelLineInput\n" +
    "- 把 privateFacts 原样写进玩家可见正文\n" +
    "- 不审查子代理候选就落地",
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
