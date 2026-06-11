import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { MemoryEvent, MemoryEventResult } from "../../engine/core/memory.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { recordMemory } from "../../engine/core/memory.ts";
import { parseMemoryEvent } from "../../engine/core/memory-schema.ts";

import { runDomainEventTool } from "./domain-tool-runner.ts";
import { isRecord } from "../../engine/core/typebox-validation.ts";

export function recordMemoryTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      const event = parseMemoryEvent(normalizeSourceEventId(params), "record_memory 参数");
      return { event, result: recordMemory(draft, event) };
    },
    details: ({ result }) => ({ result }),
    message: ({ event, result }) => formatResult(event, result),
  });
}

function formatResult(params: MemoryEvent, result: MemoryEventResult): string {
  switch (params.kind) {
    case "pin-fact":
      return `长期事实已记录：${result.factId ?? "?"}\n- ${params.text}`;
    case "record-major-event":
      return `重大事件已记录：${result.eventId ?? "?"}\n- ${params.title}: ${params.summary}`;
    case "record-daily-summary":
      return `日常摘要已记录：${result.dailySummaryId ?? "?"}\n- ${params.summary}`;
  }
}

/** pin-fact 的 sourceEventId 容错：缺失/空白一律归一为 null——领域归一化，不是校验。 */
function normalizeSourceEventId(params: unknown): unknown {
  if (!isRecord(params) || params["kind"] !== "pin-fact") {
    return params;
  }
  const raw = params["sourceEventId"];
  const sourceEventId = typeof raw === "string" && raw.trim().length > 0 ? raw : null;
  return { ...params, sourceEventId };
}

export const recordMemoryToolDefinition: FsnToolDefinition = {
  name: "record_memory",
  description:
    "写入玩家已知的长期事实、重大事件或日常摘要。每条 public memory 必须提供 claims：用结构化 claim 表达事实类型、确定性和证据；普通事实用 kind=mundane。\n\n" +
    "【必须调用的场景】\n" +
    "- 玩家身世确定；契约成立/解除/变更；NPC 死亡、失踪、重伤\n" +
    "- 真名公开、宝具首次解放、令咒使用、阵营变化、永久缺损\n" +
    "- 单次采购、调查发现、战斗结论等需要长期保留的事件：用 record-major-event，并提供 claims\n" +
    "- 半天以上时间跳过、日终或章节结束摘要：才用 record-daily-summary\n\n" +
    "【严禁的行为】\n" +
    "- 记录 GM 猜测、幕后真相、普通闲聊或短暂情绪\n" +
    "- 把玩家未确认秘密写进 public memory\n" +
    "- 非 mundane claim 缺少 evidence 或 relatedSecretSlotIds 却写成 confirmed/observed/inferred\n" +
    "- 用 record-daily-summary 绕过 claims 记录单次采购、单次调查或单次战斗结论",
  parameters: Type.Object({
    kind: Type.String({
      description: "允许: pin-fact / record-major-event / record-daily-summary",
    }),
    scope: Type.Optional(
      Type.String({ description: "可选范围，允许: protagonist / npc / faction / world" }),
    ),
    subject: Type.Optional(Type.String()),
    text: Type.Optional(Type.String()),
    sourceEventId: Type.Optional(Type.String()),
    claims: Type.Array(
      Type.Object({
        kind: Type.String({
          description:
            "claim 类型，允许: mundane / identity / location / affiliation / motive / ability / resource / relationship / event-cause / world-fact",
        }),
        statement: Type.String(),
        certainty: Type.String({
          description: "证据确信度，允许: observed / confirmed / inferred / rumor / hypothesis",
        }),
        subjectId: Type.Optional(Type.String()),
        relatedSecretSlotIds: Type.Optional(Type.Array(Type.String())),
        evidence: Type.Optional(Type.String()),
      }),
    ),
    title: Type.Optional(Type.String()),
    summary: Type.Optional(Type.String()),
    consequences: Type.Optional(Type.Array(Type.String())),
    startDate: Type.Optional(Type.String()),
    endDate: Type.Optional(Type.String()),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    recordMemoryTool(params, ctx.sessionManager),
};
