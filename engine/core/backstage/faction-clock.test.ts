import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import { advanceClock as advanceGameTime } from "../turn/turn-time.ts";
import {
  upsertFactionClock,
  advanceFactionClock,
  resetFactionClock,
  retireFactionClock,
  scheduleEvent,
  resolveScheduledEvent,
  extendScheduledEvent,
  collectBackstageDueNotices,
} from "./faction-clock.ts";

// ---------------------------------------------------------------------------
// upsertFactionClock
// ---------------------------------------------------------------------------

void test("upsertFactionClock creates a new clock", () => {
  const draft = createInitialState();

  const clock = upsertFactionClock(draft, {
    factionId: "church-of-steam",
    label: "蒸汽教会调查进度",
    size: 6,
    visibility: "hidden",
  });

  assert.ok(clock.id);
  assert.equal(clock.filled, 0);
  assert.equal(clock.size, 6);
  assert.equal(draft.secrets.factionClocks.length, 1);
});

void test("upsertFactionClock updates existing clock by id", () => {
  const draft = createInitialState();

  const original = upsertFactionClock(draft, {
    clockId: "my-clock",
    factionId: "church-of-steam",
    label: "旧标签",
    size: 4,
    visibility: "hidden",
  });

  const updated = upsertFactionClock(draft, {
    clockId: "my-clock",
    factionId: "church-of-steam",
    label: "新标签",
    size: 6,
    visibility: "leaked",
  });

  assert.equal(updated.label, "新标签");
  assert.equal(updated.size, 6);
  assert.equal(updated.visibility, "leaked");
  assert.equal(updated.id, original.id);
  assert.equal(draft.secrets.factionClocks.length, 1);
});

void test("upsertFactionClock rejects invalid size", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      upsertFactionClock(draft, {
        factionId: "test",
        label: "测试",
        size: 1,
        visibility: "hidden",
      }),
    /非法 size/,
  );
  assert.throws(
    () =>
      upsertFactionClock(draft, {
        factionId: "test",
        label: "测试",
        size: 13,
        visibility: "hidden",
      }),
    /非法 size/,
  );
});

void test("upsertFactionClock clamps filled to new size on update", () => {
  const draft = createInitialState();

  const original = upsertFactionClock(draft, {
    clockId: "my-clock",
    factionId: "a",
    label: "旧",
    size: 8,
    visibility: "hidden",
  });
  original.filled = 7;

  const updated = upsertFactionClock(draft, {
    clockId: "my-clock",
    factionId: "a",
    label: "缩小",
    size: 4,
    visibility: "hidden",
  });

  assert.equal(updated.filled, 4);
});

// ---------------------------------------------------------------------------
// advanceFactionClock
// ---------------------------------------------------------------------------

void test("advanceFactionClock adds ticks and returns becameFull", () => {
  const draft = createInitialState();
  upsertFactionClock(draft, {
    clockId: "clock-1",
    factionId: "a",
    label: "压力",
    size: 4,
    visibility: "hidden",
  });

  const result = advanceFactionClock(draft, "clock-1", 3, "局势升级");

  assert.equal(result.clock.filled, 3);
  assert.equal(result.becameFull, false);
});

void test("advanceFactionClock detects becameFull", () => {
  const draft = createInitialState();
  upsertFactionClock(draft, {
    clockId: "clock-1",
    factionId: "a",
    label: "压力",
    size: 4,
    visibility: "hidden",
  });

  const result = advanceFactionClock(draft, "clock-1", 4, "达到上限");

  assert.equal(result.clock.filled, 4);
  assert.equal(result.becameFull, true);
});

void test("advanceFactionClock clamps to size", () => {
  const draft = createInitialState();
  upsertFactionClock(draft, {
    clockId: "clock-1",
    factionId: "a",
    label: "压力",
    size: 4,
    visibility: "hidden",
  });

  const result = advanceFactionClock(draft, "clock-1", 10, "超额");

  assert.equal(result.clock.filled, 4);
  assert.equal(result.becameFull, true);
});

void test("advanceFactionClock rejects zero ticks", () => {
  const draft = createInitialState();

  assert.throws(() => advanceFactionClock(draft, "nonexistent", 0, "无推进"), /ticks 必须大于 0/);
});

void test("advanceFactionClock throws for nonexistent clock", () => {
  const draft = createInitialState();

  assert.throws(
    () => advanceFactionClock(draft, "nonexistent", 1, "测试"),
    /faction clock.*不存在/,
  );
});

// ---------------------------------------------------------------------------
// resetFactionClock
// ---------------------------------------------------------------------------

void test("resetFactionClock clears filled and logs event", () => {
  const draft = createInitialState();
  upsertFactionClock(draft, {
    clockId: "clock-1",
    factionId: "a",
    label: "压力",
    size: 4,
    visibility: "hidden",
  });
  advanceFactionClock(draft, "clock-1", 3, "推进");

  const clock = resetFactionClock(draft, "clock-1", "蒸汽教会的调查取得了突破");

  assert.equal(clock.filled, 0);
  assert.equal(draft.secrets.secretEventLog.length, 1);
  const eventLogEntry = draft.secrets.secretEventLog[0]!;
  assert.match(eventLogEntry.summary, /蒸汽教会的调查取得了突破/);
});

// ---------------------------------------------------------------------------
// retireFactionClock
// ---------------------------------------------------------------------------

void test("retireFactionClock removes clock from state", () => {
  const draft = createInitialState();
  upsertFactionClock(draft, {
    clockId: "clock-1",
    factionId: "a",
    label: "旧时钟",
    size: 4,
    visibility: "hidden",
  });

  retireFactionClock(draft, "clock-1", "已无关联");

  assert.equal(draft.secrets.factionClocks.length, 0);
});

// ---------------------------------------------------------------------------
// scheduleEvent
// ---------------------------------------------------------------------------

void test("scheduleEvent creates future event", () => {
  const draft = createInitialState();
  advanceGameTime(draft, 60, "推进");

  const event = scheduleEvent(draft, "1349-01-01T10:00:00.000Z", "教会的调查取得进展");

  assert.ok(event.id);
  assert.equal(event.summary, "教会的调查取得进展");
  assert.equal(event.dueAt, "1349-01-01T10:00:00.000Z");
});

void test("scheduleEvent rejects past time", () => {
  const draft = createInitialState();

  assert.throws(() => scheduleEvent(draft, "1349-01-01T05:00:00.000Z", "过去的事件"), /非法 dueAt/);
});

// ---------------------------------------------------------------------------
// resolveScheduledEvent
// ---------------------------------------------------------------------------

void test("resolveScheduledEvent resolves and logs event", () => {
  const draft = createInitialState();
  advanceGameTime(draft, 60, "推进");
  const event = scheduleEvent(draft, "1349-01-01T10:00:00.000Z", "调查进展");
  advanceGameTime(draft, 180, "推进到 event 之后");

  resolveScheduledEvent(draft, event.id, "教会发现了线索");

  assert.equal(draft.secrets.scheduledEvents.length, 0);
  assert.equal(draft.secrets.secretEventLog.length, 1);
  const entry = draft.secrets.secretEventLog[0]!;
  assert.match(entry.summary, /调查进展.*发现了线索/);
});

// ---------------------------------------------------------------------------
// extendScheduledEvent
// ---------------------------------------------------------------------------

void test("extendScheduledEvent postpones event", () => {
  const draft = createInitialState();
  advanceGameTime(draft, 60, "推进");
  const event = scheduleEvent(draft, "1349-01-01T12:00:00.000Z", "到期事件");

  extendScheduledEvent(draft, event.id, "1349-01-01T15:00:00.000Z", "玩家尚未涉及相关区域");

  assert.equal(event.dueAt, "1349-01-01T15:00:00.000Z");
});

void test("extendScheduledEvent rejects past newDueAt", () => {
  const draft = createInitialState();
  advanceGameTime(draft, 60, "推进");
  const event = scheduleEvent(draft, "1349-01-01T12:00:00.000Z", "测试");

  assert.throws(
    () => extendScheduledEvent(draft, event.id, "1349-01-01T07:30:00.000Z", "不应该通过"),
    /非法 newDueAt/,
  );
});

// ---------------------------------------------------------------------------
// collectBackstageDueNotices
// ---------------------------------------------------------------------------

void test("collectBackstageDueNotices detects full clocks", () => {
  const draft = createInitialState();
  advanceGameTime(draft, 60, "推进");

  upsertFactionClock(draft, {
    clockId: "full-clock",
    factionId: "a",
    label: "满时钟",
    size: 3,
    visibility: "hidden",
  });
  advanceFactionClock(draft, "full-clock", 3, "填满");

  const notices = collectBackstageDueNotices(draft);

  assert.equal(notices.length, 1);
  assert.match(notices[0]!, /阵营时钟已填满/);
});

void test("collectBackstageDueNotices detects due events", () => {
  const draft = createInitialState();
  advanceGameTime(draft, 60, "推进"); // current = 08:00
  scheduleEvent(draft, "1349-01-01T09:00:00.000Z", "到期事件"); // due at 09:00
  advanceGameTime(draft, 120, "推进到 event 之后"); // current = 10:00

  const notices = collectBackstageDueNotices(draft);

  assert.equal(notices.length, 1);
  assert.match(notices[0]!, /幕后倒计时已到期/);
});

void test("collectBackstageDueNotices returns empty when nothing due", () => {
  const draft = createInitialState();
  advanceGameTime(draft, 60, "推进");
  scheduleEvent(draft, "1349-01-01T12:00:00.000Z", "未来的事件");

  const notices = collectBackstageDueNotices(draft);

  assert.equal(notices.length, 0);
});
