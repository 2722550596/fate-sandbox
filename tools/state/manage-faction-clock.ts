import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import { Compile } from "typebox/compile";
import type { ToolResult } from "../runtime/tool-result.ts";

import {
  advanceFactionClock,
  extendScheduledEvent,
  resetFactionClock,
  resolveScheduledEvent,
  retireFactionClock,
  scheduleEvent,
  upsertFactionClock,
} from "../../engine/core/faction-clock.ts";
import { FACTION_CLOCK_VISIBILITIES } from "../../engine/core/state-schema.ts";
import { stringEnumSchema } from "../../engine/core/state-enum-schemas.ts";
import type { State } from "../../engine/core/state.ts";
import {
  assertNonEmptyString,
  isRecord,
  parseTypeBoxValue,
} from "../../engine/core/typebox-validation.ts";

import { runDomainEventTool } from "./domain-tool-runner.ts";

const MANAGE_FACTION_CLOCK_KINDS = [
  "upsert-clock",
  "advance-clock",
  "reset-clock",
  "retire-clock",
  "schedule-event",
  "resolve-due",
  "extend-due",
] as const;

export function manageFactionClockTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => executeManageFactionClock(draft, params),
    details: (message) => ({ message }),
    message: (message) => message,
  });
}

function executeManageFactionClock(draft: State, params: unknown): string {
  if (!isRecord(params)) {
    throw new Error("manage_faction_clock 参数必须是对象。");
  }
  const kind = assertNonEmptyString(params["kind"], "kind");
  switch (kind) {
    case "upsert-clock": {
      const input = parseTypeBoxValue(params, "upsert-clock 参数", UPSERT_CLOCK_VALIDATOR);
      const clock = upsertFactionClock(draft, input);
      return `阵营时钟已登记：${clock.id}｜${clock.label}（${clock.filled}/${clock.size}，${clock.visibility}）。`;
    }
    case "advance-clock": {
      const input = parseTypeBoxValue(params, "advance-clock 参数", ADVANCE_CLOCK_VALIDATOR);
      const { clock, becameFull } = advanceFactionClock(
        draft,
        input.clockId,
        input.ticks,
        input.reason,
      );
      return becameFull
        ? `阵营时钟已填满：${clock.id}｜${clock.label}（${clock.filled}/${clock.size}）。必须兑现一次格局变化，然后 reset-clock 或 retire-clock。`
        : `阵营时钟已推进：${clock.id}｜${clock.label}（${clock.filled}/${clock.size}）。`;
    }
    case "reset-clock": {
      const input = parseTypeBoxValue(params, "reset-clock 参数", RESET_CLOCK_VALIDATOR);
      const clock = resetFactionClock(draft, input.clockId, input.outcomeSummary);
      return `阵营时钟已归零：${clock.id}｜${clock.label}。格局变化已记入幕后事件日志。`;
    }
    case "retire-clock": {
      const input = parseTypeBoxValue(params, "retire-clock 参数", RETIRE_CLOCK_VALIDATOR);
      const clock = retireFactionClock(draft, input.clockId, input.reason);
      return `阵营时钟已移除：${clock.id}｜${clock.label}。`;
    }
    case "schedule-event": {
      const input = parseTypeBoxValue(params, "schedule-event 参数", SCHEDULE_EVENT_VALIDATOR);
      const event = scheduleEvent(draft, input.dueAt, input.summary);
      return `到期义务已登记：${event.id}（${event.dueAt}）${event.summary}`;
    }
    case "resolve-due": {
      const input = parseTypeBoxValue(params, "resolve-due 参数", RESOLVE_DUE_VALIDATOR);
      const event = resolveScheduledEvent(draft, input.eventId, input.outcomeSummary);
      return `到期义务已兑现并移除：${event.id}。结果已记入幕后事件日志。`;
    }
    case "extend-due": {
      const input = parseTypeBoxValue(params, "extend-due 参数", EXTEND_DUE_VALIDATOR);
      const event = extendScheduledEvent(draft, input.eventId, input.newDueAt, input.reason);
      return `到期义务已展期：${event.id} → ${event.dueAt}。`;
    }
    default:
      throw new Error(
        `不支持的 kind: ${kind}。允许: ${MANAGE_FACTION_CLOCK_KINDS.join(" / ")}。`,
      );
  }
}

const UPSERT_CLOCK_SCHEMA = Type.Object({
  kind: Type.Literal("upsert-clock"),
  clockId: Type.Optional(Type.String({ minLength: 1 })),
  factionId: Type.String({ minLength: 1 }),
  label: Type.String({ minLength: 1 }),
  size: Type.Integer({ minimum: 2, maximum: 12 }),
  visibility: stringEnumSchema(FACTION_CLOCK_VISIBILITIES),
});

const ADVANCE_CLOCK_SCHEMA = Type.Object({
  kind: Type.Literal("advance-clock"),
  clockId: Type.String({ minLength: 1 }),
  ticks: Type.Integer({ minimum: 1 }),
  reason: Type.String({ minLength: 1 }),
});

const RESET_CLOCK_SCHEMA = Type.Object({
  kind: Type.Literal("reset-clock"),
  clockId: Type.String({ minLength: 1 }),
  outcomeSummary: Type.String({ minLength: 1 }),
});

const RETIRE_CLOCK_SCHEMA = Type.Object({
  kind: Type.Literal("retire-clock"),
  clockId: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

const SCHEDULE_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("schedule-event"),
  dueAt: Type.String({ minLength: 1 }),
  summary: Type.String({ minLength: 1 }),
});

const RESOLVE_DUE_SCHEMA = Type.Object({
  kind: Type.Literal("resolve-due"),
  eventId: Type.String({ minLength: 1 }),
  outcomeSummary: Type.String({ minLength: 1 }),
});

const EXTEND_DUE_SCHEMA = Type.Object({
  kind: Type.Literal("extend-due"),
  eventId: Type.String({ minLength: 1 }),
  newDueAt: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

const UPSERT_CLOCK_VALIDATOR = Compile(UPSERT_CLOCK_SCHEMA);
const ADVANCE_CLOCK_VALIDATOR = Compile(ADVANCE_CLOCK_SCHEMA);
const RESET_CLOCK_VALIDATOR = Compile(RESET_CLOCK_SCHEMA);
const RETIRE_CLOCK_VALIDATOR = Compile(RETIRE_CLOCK_SCHEMA);
const SCHEDULE_EVENT_VALIDATOR = Compile(SCHEDULE_EVENT_SCHEMA);
const RESOLVE_DUE_VALIDATOR = Compile(RESOLVE_DUE_SCHEMA);
const EXTEND_DUE_VALIDATOR = Compile(EXTEND_DUE_SCHEMA);

export const manageFactionClockToolDefinition: FsnToolDefinition = {
  name: "manage_faction_clock",
  description:
    "管理幕后阵营进度钟与到期义务（secret state）；「世界不为玩家暂停」的机械载体。时钟与到期事件对玩家不可见，到期/填满时 canonical commit 会在返回值里催账。\n\n" +
    "【必须调用的场景】\n" +
    "- 幕后势力开始一条有方向的行动线（搜捕、仪式准备、地盘扩张）：upsert-clock 建钟，size 4/6/8 对应短/中/长线\n" +
    "- parallel-line 推进或幕后事件表明势力有实质进展：advance-clock（重大进展可一次多 tick）\n" +
    "- 未来某个游戏内时刻必然发生的事（增援抵达、仪式完成、尸体被发现）：schedule-event\n" +
    "- commit 返回值出现 ⏰ 催账：本轮内 resolve-due 兑现，或 extend-due 显式展期并给理由\n" +
    "- 时钟填满：先在叙事与状态里兑现一次格局变化，再 reset-clock（写 outcomeSummary）或 retire-clock\n\n" +
    "【严禁的行为】\n" +
    "- 把时钟内容、进度或到期事件直接透露给玩家正文；玩家只能看到 leaked 钟的征兆\n" +
    "- 无理由 advance；ticks 必须对应已发生的幕后推进\n" +
    "- 用 extend-due 无限拖延同一事件；展期理由必须是幕后局势的真实变化\n" +
    "- 时钟填满后只归零不兑现格局变化",
  parameters: Type.Object({
    kind: Type.String({
      description: "允许: upsert-clock / advance-clock / reset-clock / retire-clock / schedule-event / resolve-due / extend-due",
    }),
    clockId: Type.Optional(Type.String({ description: "advance/reset/retire 必填；upsert 可选（更新已有钟）" })),
    factionId: Type.Optional(Type.String({ description: "upsert-clock 必填：阵营/势力标识" })),
    label: Type.Optional(Type.String({ description: "upsert-clock 必填：时钟在追踪什么" })),
    size: Type.Optional(Type.Integer({ description: "upsert-clock 必填：2-12 段" })),
    visibility: Type.Optional(Type.String({ description: "upsert-clock 必填: hidden / leaked" })),
    ticks: Type.Optional(Type.Integer({ description: "advance-clock 必填：推进段数" })),
    reason: Type.Optional(Type.String({ description: "advance/retire/extend 必填：依据" })),
    outcomeSummary: Type.Optional(Type.String({ description: "reset-clock/resolve-due 必填：兑现了什么" })),
    dueAt: Type.Optional(Type.String({ description: "schedule-event 必填：游戏内 ISO 时刻" })),
    eventId: Type.Optional(Type.String({ description: "resolve-due/extend-due 必填" })),
    newDueAt: Type.Optional(Type.String({ description: "extend-due 必填：新的到期时刻" })),
    summary: Type.Optional(Type.String({ description: "schedule-event 必填：到期会发生什么" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    manageFactionClockTool(params, ctx.sessionManager),
};
