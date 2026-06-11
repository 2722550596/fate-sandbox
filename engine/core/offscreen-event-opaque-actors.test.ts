import assert from "node:assert/strict";
import test from "node:test";

import { recordOffscreenEvent } from "./offscreen-event.ts";
import { getOffscreenEventsForDebug } from "./secrets.ts";
import { createInitialState } from "./state-store.ts";

const INITIAL_TIME = "2004-01-30T07:00:00.000Z";

void test("offscreen events accepts opaque offscreen actor ids", () => {
  const draft = createInitialState();
  recordOffscreenEvent(draft, {
    lineId: "lancer-church",
    actorIds: ["cu-chulainn-lancer", "kotomine-kirei"],
    timeRange: { start: INITIAL_TIME, end: INITIAL_TIME },
    visibility: "secret",
    summary: "Lancer 完成柳洞寺外围侦察并回报教会。",
    consequences: ["教会线将柳洞寺外围列为持续监视点。"],
    futureHooks: ["玩家夜探柳洞寺时可能察觉远处视线。"],
    createdFrom: "parallel-line-subagent",
  });

  const event = getOffscreenEventsForDebug(draft)[0];
  assert.deepEqual(event?.actorIds, ["cu-chulainn-lancer", "kotomine-kirei"]);
});
