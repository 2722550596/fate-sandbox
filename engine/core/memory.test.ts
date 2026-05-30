import assert from "node:assert/strict";
import test from "node:test";

import { recordMemory } from "./memory";
import { getState, resetState } from "./state";

void test("recordMemory stores pinned facts in public campaign memory", () => {
  resetState();

  const result = recordMemory({
    kind: "pin-fact",
    scope: "protagonist",
    subject: "protagonist",
    text: "玩家确认自己是御主。",
    sourceEventId: null,
  });

  const fact = getState().public.memory.pinnedFacts.find((entry) => entry.id === result.factId);
  assert.equal(fact?.text, "玩家确认自己是御主。");
});

void test("recordMemory stores major events with consequences", () => {
  resetState();

  const result = recordMemory({
    kind: "record-major-event",
    title: "契约成立",
    summary: "玩家与 Saber 缔结契约。",
    consequences: ["玩家成为御主。"],
  });

  const event = getState().public.memory.eventLog.find((entry) => entry.id === result.eventId);
  assert.equal(event?.title, "契约成立");
  assert.deepEqual(event?.consequences, ["玩家成为御主。"]);
});
