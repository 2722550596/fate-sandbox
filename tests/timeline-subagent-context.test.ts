import assert from "node:assert/strict";
import test from "node:test";

import { configureCampaign } from "../engine/core/campaign";
import { createInitialState } from "../engine/core/state-store";
import { isRecord } from "../engine/core/typebox-validation";
import { buildTimelineStateContext } from "../extensions/subagents/timeline/index";

void test("timeline subagent context renders campaign timezone local time", () => {
  const draft = createInitialState();
  configureCampaign(draft, {
    presetId: "fsf_2008_snowfield",
    reason: "测试 Denver 时区注入。",
  });

  const raw: unknown = JSON.parse(JSON.stringify(draft));
  if (!isRecord(raw)) {
    throw new Error("serialized state must be an object");
  }

  const context = buildTimelineStateContext(raw);

  assert.equal(context.currentAt, "2008-06-03T03:00:00.000Z");
  assert.equal(context.currentAtUtc, "2008-06-03T03:00:00.000Z");
  assert.equal(context.timezone, "America/Denver");
  assert.equal(context.displayTime, "2008年06月02日 星期一 21:00");
  assert.equal(context.currentLocalTime, "2008年06月02日 星期一 21:00");
  assert.match(
    context.timeRangeRule,
    /当前 UTC 2008-06-03T03:00:00\.000Z = America\/Denver 本地 2008年06月02日 星期一 21:00/,
  );
  assert.match(context.timeRangeRule, /不得把本地时钟直接加 Z 输出/);
});
