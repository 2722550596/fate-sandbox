/**
 * run_parallel_line 领域工具（backlog #5；后台异步生成 slice A）。
 *
 * GM 只给 lineId + timeWindow + 可选偏好；engine 装配 hermetic director prompt 并
 * 【直接 fork 一个 detached `pi -p` 后台导演】——不经主 agent loop、不阻塞本回合。
 * 一次调用即起异步后台线；隔轮从 session 取裸候选 → harvest_backstage_candidate
 * 验收 → 审查 → record_offscreen_event / resolve_backstage_line 落地清账。
 */

import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { buildBackstageDirectorPrompt } from "../../core/backstage/backstage-director-prompt.ts";
import { recordPendingHarvest } from "../../core/backstage/backstage-pending.ts";
import { spawnBackstageDirector } from "../../core/backstage/backstage-spawn.ts";
import { type AssembleParallelLineInput } from "../../core/backstage/parallel-line-assembler.ts";
import { hydrateStateFromSessionManager } from "../../core/state/session-persistence.ts";
import { getState } from "../../core/state/state-store.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { runDomainEventTool } from "../system/domain-tool-runner.ts";

/** sanitize lineId into a stable run-id suffix for the director session. */
function backstageRunId(lineId: string): string {
  const slug = lineId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  const handle = spawnBackstageDirector(directorPrompt, runId);
  // 持久化 pending-harvest 标记：忘了 harvest 会被催账，且 resolve_backstage_line 被拦住（不能丢弃已产出候选）。
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      recordPendingHarvest(draft, { runId: handle.runId, lineId: input.lineId });
      return { handle, lineId: input.lineId, directorPrompt };
    },
    details: ({ handle: h, lineId, directorPrompt: prompt }) => ({
      runId: h.runId,
      lineId,
      model: h.model,
      sessionDir: h.sessionDir,
      pid: h.pid,
      directorPrompt: prompt,
    }),
    message: ({ handle: h }) =>
      [
        "后台导演已经启动（异步运行中，不阻塞本轮叙事）：",
        `  run_id=${h.runId}  model=${h.model}  session_dir=${h.sessionDir}  pid=${h.pid ?? "?"}`,
        "",
        "下一步：隔一轮（约 10-20 秒后）用 run_id 调 harvest_backstage_candidate 取回导演的输出 →",
        "审查 → 有进展用 record_offscreen_event 落地（落地即自动清掉待办提醒）",
        "或确认无进展用 resolve_backstage_line 清账（no-change/blocked）。",
        "注意：导演失败或还没跑完不算清账，你需要再试一次。",
      ].join("\n"),
  });
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
  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

export const runParallelLineToolDefinition: DomainToolDefinition = {
  name: "run_parallel_line",
  description:
    "启动一个后台导演（子代理）来推演幕后世界的动向。\n\n你只需要给一条后台线的标识（比如「廷根值夜者巡逻线」）和一个时间窗口，引擎会自动 fork 一个独立子代理去推演那段时间里幕后发生了什么——NPC 势力怎么动、有什么变数、是否升级。整个过程不阻塞本轮叙事，你可以继续写正文。\n\n【什么时候用】\n- 需要推进后台世界线，但不想手动推演全部细节\n- 长时间跳过后（>30 分钟）、Beat 收口后、连续多轮玩家不消耗资源时——这些时机系统会提示你该跑后台了\n\n操作流程：\n1. 调 run_parallel_line → 引擎自动 fork 后台导演（异步，不阻塞本轮）\n2. 隔一轮（约 10-20 秒后）用返回的 run_id 调 harvest_backstage_candidate 取回导演的输出\n3. 审查输出 → 有进展用 record_offscreen_event 落地 → 没进展用 resolve_backstage_line 清账\n\n【不要这样做】\n- 不要把子代理返回的 privateFacts / privateSummary 原样写进玩家可见的正文里\n- 不要绕过 harvest_backstage_candidate 的验收就直接落地\n- 不要手写完整的 ParallelLineInput 来绕过引擎装配的导演 prompt",
  parameters: Type.Object({
    lineId: Type.String({
      description: "后台线标识，如 tingen-nightwatch-patrol、backlund-machinery-investigation",
    }),
    timeWindow: Type.Object({
      start: Type.String({ description: "ISO UTC 起始时刻" }),
      end: Type.String({ description: "ISO UTC 结束时刻" }),
    }),
    currentArc: Type.Optional(
      Type.String({ description: "可选覆盖当前 arc；省略则从 storyWindow 推断" }),
    ),
    currentBeat: Type.Optional(
      Type.String({ description: "可选覆盖当前 beat；省略则从 storyWindow 推断" }),
    ),
    preferredPressureType: Type.Optional(
      Type.String({ description: "偏好压力类型；省略则由子代理自选" }),
    ),
    excludedActorIds: Type.Optional(Type.Array(Type.String(), { description: "硬排除 actor ids" })),
    excludedPressureTypes: Type.Optional(
      Type.Array(Type.String(), { description: "硬排除压力类型" }),
    ),
    majorBeatEnd: Type.Optional(Type.Boolean({ description: "本轮是否 beat 结束" })),
    arcTransition: Type.Optional(Type.Boolean({ description: "本轮是否 arc 转换" })),
    additionalKnownFacts: Type.Optional(
      Type.Array(Type.String(), { description: "追加 knownFacts" }),
    ),
    additionalPrivateFacts: Type.Optional(
      Type.Array(Type.String(), { description: "追加 privateFacts" }),
    ),
    allowedScope: Type.Optional(Type.Array(Type.String(), { description: "允许范围" })),
    forbiddenEscalations: Type.Optional(
      Type.Array(Type.String(), { description: "追加禁区（叠加 storyWindow）" }),
    ),
    previousLineState: Type.Optional(
      Type.String({ description: "覆盖 engine 自动拼的上一次线状态" }),
    ),
    playerSideSummary: Type.Optional(
      Type.String({ description: "覆盖 engine 自动拼的玩家侧摘要" }),
    ),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    runParallelLineTool(params, ctx.sessionManager),
};
