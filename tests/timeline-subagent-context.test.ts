import assert from "node:assert/strict";
import test from "node:test";

import { recordActorKnowledgeFact, upsertActorAgenda } from "../engine/core/actor-agenda.ts";
import { configureCampaign } from "../engine/core/campaign.ts";
import { recordRelationshipSignal } from "../engine/core/relationship-signal.ts";
import { createInitialState } from "../engine/core/state-store.ts";
import { isRecord } from "../engine/core/typebox-validation.ts";
import { buildTimelineStateContext } from "../extensions/subagents/timeline/index.ts";

void test("timeline subagent context renders campaign timezone local time", () => {
  const draft = createInitialState();
  configureCampaign(draft, {
    presetId: "fsf_2008_snowfield",
    reason: "测试 Denver 时区注入。",
  });
  upsertActorAgenda(draft, {
    actorId: "protagonist",
    goal: "leave the exposed street",
    fear: "being fixed by surveillance",
    currentOrder: "keep moving",
    lastIndependentActionAt: null,
  });
  recordActorKnowledgeFact(draft, "protagonist", "suspects", "the cordon is not random");
  recordRelationshipSignal(draft, {
    actorId: "protagonist",
    targetActorId: "protagonist",
    signal: "keeps moving instead of asking for help",
    interpretation: "self-protection is overriding trust",
    boundary: "do not frame this as resolved trust",
    sourceEventId: null,
    visibility: "player-known",
  });
  draft.secrets.offscreenEventLog.push({
    id: "offscreen-1",
    lineId: "orlando-police",
    actorIds: ["orlando"],
    timeRange: { start: "2008-06-03T02:30:00.000Z", end: "2008-06-03T03:00:00.000Z" },
    visibility: "secret",
    summary: "Police patrols expand their camera review around the player route.",
    consequences: ["Institutional search pressure increases"],
    futureHooks: ["A camera gap can become an actionable trace"],
    createdFrom: "gm",
    pressureType: "servant-autonomy",
    pressureSlotId: null,
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

  const protagonist = context.actors.find((actor) => actor.actorId === "protagonist");
  assert.ok(protagonist);
  assert.equal(protagonist.agenda?.goal, "leave the exposed street");
  assert.deepEqual(protagonist.knowledgeLens?.suspects, ["the cordon is not random"]);
  assert.equal(context.relationshipSignals[0]?.signal, "keeps moving instead of asking for help");

  const institutional = context.pressurePalette.find(
    (slot) => slot.id === "fsf-institutional-line",
  );
  assert.ok(institutional);
  assert.equal(institutional.recentUses, 1);
  assert.equal(institutional.coolingDown, true);
  assert.ok(context.pressurePalette.some((slot) => slot.id === "fsf-land-myth-aftermath"));
});
