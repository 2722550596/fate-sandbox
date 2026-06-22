import assert from "node:assert/strict";
import test from "node:test";

import { upsertActorAgenda } from "./actor-agenda.ts";
import { configureCampaign } from "./campaign.ts";
import { recordOffscreenEvent } from "./offscreen-event.ts";
import { assembleParallelLineInput } from "./parallel-line-assembler.ts";
import { createInitialState } from "./state-store.ts";

void test("assembleParallelLineInput fills fields from state automatically", () => {
  const draft = createInitialState();

  upsertActorAgenda(draft, {
    actorId: "protagonist",
    goal: "survive the night",
    fear: "being caught",
    currentOrder: "keep moving",
    lastIndependentActionAt: null,
  });

  const result = assembleParallelLineInput(draft, {
    lineId: "caster-ryudou",
    timeWindow: { start: "2004-01-30T21:00:00.000Z", end: "2004-01-30T23:00:00.000Z" },
  });

  assert.equal(result.lineId, "caster-ryudou");
  assert.equal(result.timelineId, "fsn");
  assert.equal(result.timeWindow.start, "2004-01-30T21:00:00.000Z");
  assert.ok(result.actorGoals.length > 0);
  assert.match(result.actorGoals[0] ?? "", /survive the night/);
  assert.ok(result.activePressurePalette.length > 0);
  assert.match(result.playerSideSummary, /protagonist|你/);
  assert.match(result.previousLineState, /No previous line state/);
});

void test("assembleParallelLineInput injects recent offscreen events and pressure cooldowns", () => {
  const draft = createInitialState();
  draft.public.clock.currentAt = "2004-01-31T00:00:00.000Z";
  recordOffscreenEvent(draft, {
    lineId: "lancer-church",
    actorIds: ["lancer"],
    timeRange: { start: "2004-01-30T20:00:00.000Z", end: "2004-01-30T21:00:00.000Z" },
    visibility: "secret",
    summary: "Lancer scouting the east gate",
    consequences: ["east route watched"],
    futureHooks: ["trap"],
    createdFrom: "gm",
    pressureType: "servant-autonomy",
    pressureSlotId: null,
  });

  const result = assembleParallelLineInput(draft, {
    lineId: "caster-ryudou",
    timeWindow: { start: "2004-01-30T21:00:00.000Z", end: "2004-01-30T23:00:00.000Z" },
  });

  assert.ok(result.recentOffscreenEvents !== undefined);
  assert.equal(result.recentOffscreenEvents.length, 1);
  assert.equal(result.recentOffscreenEvents[0]?.lineId, "lancer-church");
  assert.match(result.recentOffscreenEvents[0]?.pressureType ?? "", /servant-autonomy/);
});

void test("assembleParallelLineInput merges storyWindow forbiddenEscalations", () => {
  const draft = createInitialState();
  draft.public.scene.storyWindow = {
    currentArcId: "arc-1",
    currentBeatId: "beat-1",
    title: "test",
    allowedActions: [],
    forbiddenEscalations: ["do not trigger combat"],
    completionCriteria: [],
    nextBeatHints: [],
  };

  const result = assembleParallelLineInput(draft, {
    lineId: "test-line",
    timeWindow: { start: "2004-01-30T21:00:00.000Z", end: "2004-01-30T23:00:00.000Z" },
    forbiddenEscalations: ["do not reveal true name"],
  });

  assert.deepEqual(result.forbiddenEscalations, [
    "do not reveal true name",
    "do not trigger combat",
  ]);
  assert.equal(result.currentArc, "arc-1");
  assert.equal(result.currentBeat, "beat-1");
});

void test("assembleParallelLineInput picks FSF timeline palette", () => {
  const draft = createInitialState();
  configureCampaign(draft, {
    presetId: "fsf_2008_snowfield",
    reason: "test FSF palette",
  });

  const result = assembleParallelLineInput(draft, {
    lineId: "orlando-police",
    timeWindow: { start: "2008-06-03T02:00:00.000Z", end: "2008-06-03T03:00:00.000Z" },
    preferredPressureType: "authority-surveillance",
  });

  assert.equal(result.timelineId, "fsf");
  assert.ok(result.activePressurePalette.some((slot) => slot.id === "fsf-institutional-line"));
  assert.equal(result.preferredPressureType, "authority-surveillance");
});

void test("assembleParallelLineInput extracts privateFacts from campaign secrets", () => {
  const draft = createInitialState();
  draft.secrets.campaignSecrets.push({
    id: "secret-1",
    text: "the grail is corrupted",
    relatedActorIds: [],
    revealState: "hidden",
  });

  const result = assembleParallelLineInput(draft, {
    lineId: "test",
    timeWindow: { start: "2004-01-30T21:00:00.000Z", end: "2004-01-30T23:00:00.000Z" },
  });

  assert.ok(result.privateFacts.includes("the grail is corrupted"));
});
