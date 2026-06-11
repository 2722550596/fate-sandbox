import type { State } from "./state.ts";

import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceFactionClock,
  collectBackstageDueNotices,
  extendScheduledEvent,
  resetFactionClock,
  resolveScheduledEvent,
  retireFactionClock,
  scheduleEvent,
  upsertFactionClock,
} from "./faction-clock.ts";
import { createInitialState } from "./state-store.ts";
import { commitTurn } from "./turn-commit.ts";
import { advanceClock } from "./turn-time.ts";

function draftWithClock(size = 4): { draft: State; clockId: string } {
  const draft = createInitialState();
  const clock = upsertFactionClock(draft, {
    factionId: "matou",
    label: "间桐家完成圣杯容器准备",
    size,
    visibility: "hidden",
  });
  return { draft, clockId: clock.id };
}

void test("upsertFactionClock creates and updates clocks", () => {
  const { draft, clockId } = draftWithClock(4);
  assert.equal(draft.secrets.factionClocks.length, 1);

  const updated = upsertFactionClock(draft, {
    clockId,
    factionId: "matou",
    label: "间桐家完成圣杯容器准备",
    size: 6,
    visibility: "leaked",
  });
  assert.equal(draft.secrets.factionClocks.length, 1);
  assert.equal(updated.size, 6);
  assert.equal(updated.visibility, "leaked");
});

void test("advanceFactionClock caps at size and reports the fill transition", () => {
  const { draft, clockId } = draftWithClock(4);

  const first = advanceFactionClock(draft, clockId, 3, "夜间仪式推进");
  assert.equal(first.clock.filled, 3);
  assert.equal(first.becameFull, false);

  const second = advanceFactionClock(draft, clockId, 5, "重大突破");
  assert.equal(second.clock.filled, 4);
  assert.equal(second.becameFull, true);

  const third = advanceFactionClock(draft, clockId, 1, "已满后再推");
  assert.equal(third.becameFull, false);
});

void test("resetFactionClock logs the outcome and zeroes the clock", () => {
  const { draft, clockId } = draftWithClock(2);
  advanceFactionClock(draft, clockId, 2, "推满");

  resetFactionClock(draft, clockId, "影之怪物开始在深夜袭击行人，新闻报导气体中毒事件。");

  assert.equal(draft.secrets.factionClocks[0]?.filled, 0);
  assert.match(draft.secrets.secretEventLog.at(-1)?.summary ?? "", /气体中毒/);
});

void test("scheduleEvent rejects past dueAt and collectBackstageDueNotices surfaces due items", () => {
  const { draft, clockId } = draftWithClock(2);

  assert.throws(
    () => scheduleEvent(draft, draft.public.clock.currentAt, "立即到期"),
    /不晚于当前游戏时间/,
  );

  const due = scheduleEvent(
    draft,
    addMinutes(draft.public.clock.currentAt, 30),
    "教会增援抵达冬木",
  );
  assert.equal(collectBackstageDueNotices(draft).length, 0);

  advanceClock(draft, 31, "时间越过 dueAt");
  advanceFactionClock(draft, clockId, 2, "推满时钟");

  const notices = collectBackstageDueNotices(draft);
  assert.equal(notices.length, 2);
  assert.match(notices[0] ?? "", /幕后倒计时已到期/);
  assert.match(notices[0] ?? "", new RegExp(due.id));
  assert.match(notices[1] ?? "", /阵营时钟已填满/);
});

void test("resolve and extend clear or defer due notices", () => {
  const { draft } = draftWithClock(4);
  const event = scheduleEvent(draft, addMinutes(draft.public.clock.currentAt, 10), "尸体被发现");
  advanceClock(draft, 20, "越过期限");
  assert.equal(collectBackstageDueNotices(draft).length, 1);

  extendScheduledEvent(
    draft,
    event.id,
    addMinutes(draft.public.clock.currentAt, 60),
    "巡警换班延误",
  );
  assert.equal(collectBackstageDueNotices(draft).length, 0);

  advanceClock(draft, 61, "再次越过期限");
  resolveScheduledEvent(draft, event.id, "尸体被晨跑者发现，警方封锁公园。");
  assert.equal(draft.secrets.scheduledEvents.length, 0);
  assert.equal(collectBackstageDueNotices(draft).length, 0);
});

void test("retireFactionClock removes the clock", () => {
  const { draft, clockId } = draftWithClock(4);
  retireFactionClock(draft, clockId, "该势力已退场");
  assert.equal(draft.secrets.factionClocks.length, 0);
});

void test("commitTurn surfaces due notices as warnings when time crosses dueAt", () => {
  const { draft } = draftWithClock(4);
  scheduleEvent(draft, addMinutes(draft.public.clock.currentAt, 15), "增援抵达");

  const result = commitTurn(draft, {
    summary: "等待中时间流逝。",
    time: { kind: "elapsed", elapsedMinutes: 20, reason: "原地休整" },
    events: [],
  });

  assert.equal(
    result.warnings.some((entry) => entry.includes("幕后倒计时已到期")),
    true,
  );
  assert.match(result.message, /幕后倒计时已到期/);
});

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}
