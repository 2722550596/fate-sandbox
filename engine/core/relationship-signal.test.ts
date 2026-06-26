import assert from "node:assert/strict";
import test from "node:test";

import {
  recordRelationshipSignal,
  recentPlayerKnownRelationshipSignals,
} from "./relationship-signal.ts";
import { createInitialState } from "./state-store.ts";

const PROTAGONIST_ACTOR_ID = "protagonist";

void test("recordRelationshipSignal splits player-known and secret ledgers", () => {
  const draft = createInitialState();

  const publicSignal = recordRelationshipSignal(draft, {
    actorId: PROTAGONIST_ACTOR_ID,
    targetActorId: PROTAGONIST_ACTOR_ID,
    signal: " she slows down before answering ",
    interpretation: "guarded concern, not consent",
    boundary: "do not turn concern into confession",
    sourceEventId: null,
    visibility: "player-known",
  });
  const secretSignal = recordRelationshipSignal(draft, {
    actorId: PROTAGONIST_ACTOR_ID,
    targetActorId: PROTAGONIST_ACTOR_ID,
    signal: "she checks whether the player notices the old family seal",
    interpretation: "testing player knowledge",
    boundary: "she will not explain the seal first",
    sourceEventId: "event-1",
    visibility: "secret",
  });

  assert.equal(publicSignal.id, "relationship-signal-1");
  assert.equal(secretSignal.id, "relationship-signal-2");
  assert.equal(publicSignal.signal, "she slows down before answering");
  assert.deepEqual(draft.public.relationshipSignals, [publicSignal]);
  assert.deepEqual(draft.secrets.relationshipSignals, [secretSignal]);
});

void test("recentPlayerKnownRelationshipSignals returns newest player-safe entries", () => {
  const draft = createInitialState();
  for (let i = 1; i <= 3; i++) {
    recordRelationshipSignal(draft, {
      actorId: PROTAGONIST_ACTOR_ID,
      targetActorId: PROTAGONIST_ACTOR_ID,
      signal: `gesture ${i}`,
      interpretation: `interpretation ${i}`,
      boundary: `boundary ${i}`,
      sourceEventId: null,
      visibility: "player-known",
    });
  }

  const recent = recentPlayerKnownRelationshipSignals(draft.public, 2);

  assert.deepEqual(
    recent.map((signal) => signal.signal),
    ["gesture 2", "gesture 3"],
  );
  const firstRecent = recent[0];
  assert.ok(firstRecent);
  firstRecent.signal = "mutated";
  assert.equal(draft.public.relationshipSignals[1]?.signal, "gesture 2");
});

void test("recordRelationshipSignal rejects missing actors and empty fields", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      recordRelationshipSignal(draft, {
        actorId: "ghost",
        targetActorId: PROTAGONIST_ACTOR_ID,
        signal: "pause",
        interpretation: "concern",
        boundary: "no confession",
        sourceEventId: null,
        visibility: "player-known",
      }),
    /actor ghost 不存在/,
  );
  assert.throws(
    () =>
      recordRelationshipSignal(draft, {
        actorId: PROTAGONIST_ACTOR_ID,
        targetActorId: PROTAGONIST_ACTOR_ID,
        signal: " ",
        interpretation: "concern",
        boundary: "no confession",
        sourceEventId: null,
        visibility: "player-known",
      }),
    /signal: 不能为空/,
  );
});

void test("recordRelationshipSignal blocks player-known unrevealed secret strings", () => {
  const draft = createInitialState();
  draft.secrets.actorStates[PROTAGONIST_ACTOR_ID] = {
    actorId: PROTAGONIST_ACTOR_ID,
    secrets: {
      actorId: PROTAGONIST_ACTOR_ID,
      pathwaySecret: {
        id: "protagonist-pathway-secret",
        value: "偷盗者途径",
        revealState: "hidden",
        revealConditions: ["revealed in story"],
      },
      privateMotives: [],
      unrevealedAffiliations: [],
    },
  };

  assert.throws(
    () =>
      recordRelationshipSignal(draft, {
        actorId: PROTAGONIST_ACTOR_ID,
        targetActorId: PROTAGONIST_ACTOR_ID,
        signal: "the pause says Artoria Pendragon matters",
        interpretation: "unsafe leak",
        boundary: "unsafe leak",
        sourceEventId: null,
        visibility: "player-known",
      }),
    /不能包含未揭示秘密字符串/,
  );

  recordRelationshipSignal(draft, {
    actorId: PROTAGONIST_ACTOR_ID,
    targetActorId: PROTAGONIST_ACTOR_ID,
    signal: "the pause says Artoria Pendragon matters",
    interpretation: "secret-only interpretation",
    boundary: "do not render directly",
    sourceEventId: null,
    visibility: "secret",
  });

  assert.equal(draft.secrets.relationshipSignals.length, 1);
});
