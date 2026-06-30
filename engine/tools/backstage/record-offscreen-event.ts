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
    "记录玩家看不到的幕后事件。\n\nNPC 阵营在视野外做了什么、暗中的侦察和准备、未来可能浮出水面的线索——这些都可以通过这个工具记录到秘密状态里。玩家不会直接看到这些内容，但可以通过剧情中的蛛丝马迹（传闻、梦境、异常投影、后果）间接感知到。\n\n【什么时候用】\n- 后台导演（subagent）产出的候选事件要落地到状态里\n- NPC 阵营在玩家视野外行动：侦察、准备、转移、调动、传令\n- 记录未来可能触发的线索或 hook，但暂时不公开到玩家记忆里\n\n【visibility 含义】\n- secret：完全隐藏，玩家不应知道\n- foreshadowed：玩家可能会通过梦境、传闻、异常波动等方式有所感知，但不确定具体内容\n\n【不要这样做】\n- 不要写入玩家已经知道的事实（那属于 record_memory 或其他 update 工具）\n- 不要把 privateSummary 原样展示给玩家\n- 不要越过剧情窗口的边界或违反 forbiddenEscalations",
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
        "canonical 后台压力类型，取自 run_parallel_line 返回的 activePressurePalette 里某个 slot 的 pressureType（如 beyonder-autonomy / church-supervision）",
    }),
    pressureSlotId: Type.Optional(
      Type.String({
        description:
          "可选：对应 pressure palette slot 的 id（如 tingen-nightwatcher-patrol / tingen-machinery-heart-investigation）",
      }),
    ),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    recordOffscreenEventTool(params, ctx.sessionManager),
};
