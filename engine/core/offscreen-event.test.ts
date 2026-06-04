import assert from "node:assert/strict";
import test from "node:test";

import { buildGmBrief } from "./gm-brief";
import { recordOffscreenEvent } from "./offscreen-event";
import { getOffscreenEventsForDebug } from "./secrets";
import { advanceClock, getPublicState, resetState } from "./state";

const INITIAL_TIME = "2004-01-30T07:00:00.000Z";

void test("offscreen events records secret offscreen events outside the public GM brief", () => {
  resetState();
  advanceClock(60, "测试推进到幕后事件结束后");
  const result = recordOffscreenEvent({
    lineId: "lancer-church",
    actorIds: ["protagonist"],
    timeRange: { start: INITIAL_TIME, end: INITIAL_TIME },
    visibility: "secret",
    summary: "库丘林完成森林外缘侦察。",
    consequences: ["言峰命令库丘林明晚继续监视柳洞寺外围。"],
    futureHooks: ["玩家靠近柳洞寺外围时可能被 Lancer 发现。"],
    createdFrom: "parallel-line-subagent",
  });

  assert.match(result.eventId, /^offscreen-event-/);
  assert.equal(getOffscreenEventsForDebug().length, 1);
  assert.doesNotMatch(buildGmBrief(getPublicState()), /库丘林完成森林外缘侦察/);
});

void test("offscreen events rejects direct player-known writes", () => {
  resetState();
  advanceClock(60, "测试推进到幕后事件结束后");
  assert.throws(
    () =>
      recordOffscreenEvent({
        lineId: "lancer-church",
        actorIds: ["protagonist"],
        timeRange: { start: INITIAL_TIME, end: INITIAL_TIME },
        visibility: "player-known",
        summary: "这不应由幕后事件工具直接公开。",
        consequences: [],
        futureHooks: [],
        createdFrom: "parallel-line-subagent",
      }),
    /不能直接写入 player-known/,
  );
});
