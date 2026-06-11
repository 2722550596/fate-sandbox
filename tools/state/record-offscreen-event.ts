import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { ToolResult } from "../runtime/tool-result.ts";

import { recordOffscreenEvent } from "../../engine/core/offscreen-event.ts";
import { parseRecordOffscreenEventInput } from "../../engine/core/offscreen-event-schema.ts";

import { runDomainEventTool } from "./domain-tool-runner.ts";
import { isRecord } from "../../engine/core/typebox-validation.ts";

export function recordOffscreenEventTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      assertNotPlayerKnown(params);
      const event = parseRecordOffscreenEventInput(params, "record_offscreen_event 参数");
      return { event, result: recordOffscreenEvent(draft, event) };
    },
    details: ({ result }) => ({ result }),
    message: ({ event, result }) => `幕后事件已记录：${result.eventId}\n- ${event.summary}`,
  });
}

/** player-known 有专属指引（改用 record_memory），必须先于 schema 枚举报错。 */
function assertNotPlayerKnown(params: unknown): void {
  if (isRecord(params) && params["visibility"] === "player-known") {
    throw new Error("record_offscreen_event 禁止写入 player-known；请改用 record_memory。");
  }
}

export const recordOffscreenEventToolDefinition: FsnToolDefinition = {
  name: "record_offscreen_event",
  description:
    "写入玩家不可见或仅预示的幕后事件；用于平行线 subagent 候选结果落地。\n\n" +
    "【必须调用的场景】\n" +
    "- 平行线 subagent 返回 offscreen/secret 事件，需要成为 canonical secret state\n" +
    "- NPC 阵营在玩家视野外完成侦察、准备、转移、结界调整或命令传达\n" +
    "- 需要保存 future hooks，但暂不写入 public memory\n\n" +
    "【严禁的行为】\n" +
    "- 写入 player-known；公开事实必须用 record_memory 或对应 update 工具\n" +
    "- 把 privateSummary 原样展示给玩家\n" +
    "- 越过当前剧情窗口或违反 forbiddenEscalations",
  parameters: Type.Object({
    lineId: Type.String(),
    actorIds: Type.Array(Type.String()),
    timeRange: Type.Object({ start: Type.String(), end: Type.String() }),
    visibility: Type.String({ description: "允许: secret / foreshadowed" }),
    summary: Type.String(),
    consequences: Type.Array(Type.String()),
    futureHooks: Type.Array(Type.String()),
    createdFrom: Type.String({ description: "允许: parallel-line-subagent / gm / debug" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    recordOffscreenEventTool(params, ctx.sessionManager),
};
