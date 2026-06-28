import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import { recordOffscreenEvent } from "./offscreen-event.ts";

void test("recordOffscreenEvent records a secret visibility event", () => {
  const draft = createInitialState();
  draft.public.clock.currentAt = "2004-01-30T10:00:00.000Z";
  const result = recordOffscreenEvent(draft, {
    lineId: "line-1",
    actorIds: ["npc-1"],
    timeRange: {
      start: "2004-01-30T08:00:00.000Z",
      end: "2004-01-30T09:00:00.000Z",
    },
    visibility: "secret",
    summary: "npc-1 秘密完成了某个仪式",
    consequences: ["仪式地点残留非凡气息"],
    futureHooks: ["后续调查可发现仪式痕迹"],
    createdFrom: "gm",
    pressureType: "ritual",
    pressureSlotId: null,
  });

  assert.ok(result.eventId);
  assert.equal(draft.secrets.offscreenEventLog.length, 1);
  assert.equal(draft.secrets.offscreenEventLog[0]?.summary, "npc-1 秘密完成了某个仪式");
  assert.equal(draft.secrets.offscreenEventLog[0]?.visibility, "secret");
});

void test("recordOffscreenEvent records a foreshadowed visibility event", () => {
  const draft = createInitialState();
  draft.public.clock.currentAt = "2004-01-30T10:00:00.000Z";
  const result = recordOffscreenEvent(draft, {
    lineId: "line-1",
    actorIds: ["npc-1"],
    timeRange: {
      start: "2004-01-30T08:00:00.000Z",
      end: "2004-01-30T09:00:00.000Z",
    },
    visibility: "foreshadowed",
    summary: "npc-1 的某次行动留下了可疑痕迹",
    consequences: ["玩家角色可能感知到异常"],
    futureHooks: [],
    createdFrom: "gm",
    pressureType: "investigation",
    pressureSlotId: "slot-1",
  });

  assert.ok(result.eventId);
  assert.equal(draft.secrets.offscreenEventLog[0]?.visibility, "foreshadowed");
  assert.equal(draft.secrets.offscreenEventLog[0]?.pressureSlotId, "slot-1");
});

void test("recordOffscreenEvent rejects player-known visibility", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      recordOffscreenEvent(draft, {
        lineId: "line-1",
        actorIds: ["npc-1"],
        timeRange: {
          start: "2004-01-30T08:00:00.000Z",
          end: "2004-01-30T09:00:00.000Z",
        },
        summary: "test",
        visibility: "player-known",
        consequences: [],
        futureHooks: [],
        createdFrom: "gm",
        pressureType: "test",
        pressureSlotId: null,
      }),
    /不能直接写入 player-known/,
  );
});

void test("recordOffscreenEvent rejects future time range", () => {
  const draft = createInitialState();

  // Set clock to a specific time
  draft.public.clock.currentAt = "2004-01-30T12:00:00.000Z";

  assert.throws(
    () =>
      recordOffscreenEvent(draft, {
        lineId: "line-1",
        actorIds: ["npc-1"],
        timeRange: {
          start: "2004-01-30T13:00:00.000Z",
          end: "2004-01-30T14:00:00.000Z",
        },
        visibility: "secret",
        summary: "未来的事件",
        consequences: [],
        futureHooks: [],
        createdFrom: "gm",
        pressureType: "test",
        pressureSlotId: null,
      }),
    /只能记录已完成的幕后事件/,
  );
});

void test("recordOffscreenEvent rejects end before start time range", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      recordOffscreenEvent(draft, {
        lineId: "line-1",
        actorIds: ["npc-1"],
        timeRange: {
          start: "2004-01-30T10:00:00.000Z",
          end: "2004-01-30T09:00:00.000Z",
        },
        visibility: "secret",
        summary: "时间错乱的事件",
        consequences: [],
        futureHooks: [],
        createdFrom: "gm",
        pressureType: "test",
        pressureSlotId: null,
      }),
    /timeRange.end 不能早于 timeRange.start/,
  );
});
