import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import {
  resetBackstagePressure,
  settleOldestBackstageObligation,
} from "../../core/backstage/backstage-obligation.ts";
import { clearPendingHarvestByLine } from "../../core/backstage/backstage-pending.ts";
import { parseRecordOffscreenEventInput } from "../../core/knowledge/offscreen-event-schema.ts";
import { recordOffscreenEvent } from "../../core/knowledge/offscreen-event.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { runDomainEventTool } from "../system/domain-tool-runner.ts";

export function recordOffscreenEventTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      assertNotPlayerKnown(params);
      const event = parseRecordOffscreenEventInput(params, "record_offscreen_event 参数");
      const result = recordOffscreenEvent(draft, event);
      // 后台进展落地：清掉最旧一条未清账义务（若有），并打断 no-cost 连击。
      settleOldestBackstageObligation(draft, {
        outcome: "landed",
        reasonCode: "candidate-landed",
        note: event.summary,
      });
      // 该 line 的候选已落地：清掉它的 pending-harvest 标记（含未经 harvest 直接手动落地的情形）。
      clearPendingHarvestByLine(draft, event.lineId);
      resetBackstagePressure(draft);
      return { event, result };
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

export const recordOffscreenEventToolDefinition: DomainToolDefinition = {
  name: "record_offscreen_event",
  description:
    "写入玩家不可见或仅预示的幕后事件；用于平行线 subagent 候选落地。\n\n" +
    "【使用边界】\n" +
    "- 平行线 subagent 返回的 offscreen/secret 事件要成为 canonical secret state\n" +
    "- NPC 阵营在视野外侦察/准备/转移/调结界/传令\n" +
    "- 保存 future hooks 但暂不入 public memory\n\n" +
    "禁区：\n" +
    "- 写入 player-known（公开事实用 record_memory 或对应 update 工具）\n" +
    "- 把 privateSummary 原样展示给玩家\n" +
    "- 越过剧情窗口或违反 forbiddenEscalations",
  parameters: Type.Object({
    lineId: Type.String(),
    actorIds: Type.Array(Type.String()),
    timeRange: Type.Object({ start: Type.String(), end: Type.String() }),
    visibility: Type.String({ description: "允许: secret / foreshadowed" }),
    summary: Type.String(),
    consequences: Type.Array(Type.String()),
    futureHooks: Type.Array(Type.String()),
    createdFrom: Type.String({ description: "允许: parallel-line-subagent / gm / debug" }),
    pressureType: Type.String({
      description:
        "canonical 后台压力类型，取自 run_parallel_line 返回的 activePressurePalette 里某个 slot 的 pressureType（如 beyonder-activity / church-supervision）",
    }),
    pressureSlotId: Type.Optional(
      Type.String({
        description:
          "可选：对应 pressure palette slot 的 id（如 nighthawk-patrol / machinery-heart-investigation）",
      }),
    ),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    recordOffscreenEventTool(params, ctx.sessionManager),
};
