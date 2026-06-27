import assert from "node:assert/strict";
import test from "node:test";

import { parseStateSchema } from "./state-schema.ts";
import { createInitialState } from "./state-store.ts";
import { isRecord } from "../utils/typebox-validation.ts";

void test("parseStateSchema round-trips a freshly initialized state", () => {
  const draft = createInitialState();
  const state = draft;

  const parsed = parseStateSchema(state);

  assert.deepEqual(parsed, state);
});

void test("parseStateSchema rejects unknown enum values with field path", () => {
  const raw = rawState();
  section(section(raw, "public"), "campaign")["timeline"] = "nope";

  assert.throws(() => parseStateSchema(raw), /campaign\.timeline 必须是允许值之一/);
});

void test("parseStateSchema rejects actor registry key mismatch", () => {
  const raw = rawState();
  const actors = section(section(raw, "public"), "actors");
  actors["impostor"] = actors["protagonist"];

  assert.throws(
    () => parseStateSchema(raw),
    /actor registry key impostor 与 actor\.id protagonist 不一致/,
  );
});

void test("parseStateSchema rejects dangling actor references", () => {
  const raw = rawState();
  section(raw, "public")["allyActorIds"] = ["no-such-actor"];

  assert.throws(() => parseStateSchema(raw), /非法allyActorIds\[\]: actor no-such-actor 不存在/);
});

void test("parseStateSchema defaults a missing offscreenEventLog to an empty array", () => {
  const raw = rawState();
  delete section(raw, "secrets")["offscreenEventLog"];

  const parsed = parseStateSchema(raw);

  assert.deepEqual(parsed.secrets.offscreenEventLog, []);
});

void test("parseStateSchema trims strings and strips unknown fields", () => {
  const raw = rawState();
  section(section(raw, "public"), "campaign")["title"] = "  冬木圣杯战争  ";
  raw["legacyField"] = "should be stripped";

  const parsed = parseStateSchema(raw);

  assert.equal(parsed.public.campaign.title, "冬木圣杯战争");
  assert.equal("legacyField" in parsed, false);
});

void test("parseStateSchema normalizes ISO instants to canonical form", () => {
  const raw = rawState();
  section(section(raw, "public"), "clock")["currentAt"] = "2004-01-30T16:00:00+09:00";

  const parsed = parseStateSchema(raw);

  assert.equal(parsed.public.clock.currentAt, "2004-01-30T07:00:00.000Z");
});

void test("parseStateSchema rejects malformed ISO instants", () => {
  const raw = rawState();
  section(section(raw, "public"), "clock")["currentAt"] = "昨天下午";

  assert.throws(() => parseStateSchema(raw), /clock\.currentAt必须是 ISO 时间字符串/);
});

void test("parseStateSchema rejects actorStates bundle key mismatch and orphans", () => {
  const mismatch = rawState();
  section(section(mismatch, "secrets"), "actorStates")["protagonist"] = { actorId: "saber" };
  assert.throws(
    () => parseStateSchema(mismatch),
    /actorStates key protagonist 与 actorId saber 不一致/,
  );

  const orphan = rawState();
  section(section(orphan, "secrets"), "actorStates")["ghost"] = {
    actorId: "ghost",
    secrets: {
      actorId: "ghost",
      hiddenNoblePhantasms: [],
      privateMotives: [],
      unrevealedAffiliations: [],
    },
  };
  assert.throws(() => parseStateSchema(orphan), /非法actorStates key: actor ghost 不存在/);
});

void test("parseStateSchema validates actor agenda facet actorId against bundle key", () => {
  const raw = rawState();
  section(section(raw, "secrets"), "actorStates")["protagonist"] = {
    actorId: "protagonist",
    agenda: {
      actorId: "saber",
      goal: "leave the school gate",
      fear: "being watched",
      currentOrder: null,
      lastIndependentActionAt: null,
    },
  };

  assert.throws(
    () => parseStateSchema(raw),
    /actorStates.protagonist.agenda.actorId saber 与 key 不一致/,
  );
});

void test("parseStateSchema validates actor knowledge lens facet actorId against bundle key", () => {
  const raw = rawState();
  section(section(raw, "secrets"), "actorStates")["protagonist"] = {
    actorId: "protagonist",
    knowledgeLens: {
      actorId: "saber",
      knows: ["A"],
      suspects: [],
      falseBeliefs: [],
      forbiddenKnowledge: [],
    },
  };

  assert.throws(
    () => parseStateSchema(raw),
    /actorStates.protagonist.knowledgeLens.actorId saber 与 key 不一致/,
  );
});

void test("parseStateSchema normalizes actor agenda independent-action time", () => {
  const raw = rawState();
  section(section(raw, "secrets"), "actorStates")["protagonist"] = {
    actorId: "protagonist",
    agenda: {
      actorId: "protagonist",
      goal: "cross the gate",
      fear: "being noticed",
      currentOrder: "move",
      lastIndependentActionAt: "2004-01-30T16:00:00+09:00",
    },
  };

  const parsed = parseStateSchema(raw);

  assert.equal(
    parsed.secrets.actorStates["protagonist"]?.agenda?.lastIndependentActionAt,
    "2004-01-30T07:00:00.000Z",
  );
});

void test("parseStateSchema validates relationship signal actor refs, visibility layers, and ids", () => {
  const raw = rawState();
  section(raw, "public")["relationshipSignals"] = [
    {
      id: "relationship-signal-1",
      actorId: "protagonist",
      targetActorId: "protagonist",
      signal: "hesitates before answering",
      interpretation: "guarded concern",
      boundary: "do not overstate intimacy",
      sourceEventId: null,
      visibility: "player-known",
    },
  ];
  section(raw, "secrets")["relationshipSignals"] = [
    {
      id: "relationship-signal-1",
      actorId: "protagonist",
      targetActorId: "protagonist",
      signal: "tests the boundary",
      interpretation: "private suspicion",
      boundary: "do not render directly",
      sourceEventId: null,
      visibility: "secret",
    },
  ];

  assert.throws(() => parseStateSchema(raw), /重复 relationship signal id/);

  section(raw, "secrets")["relationshipSignals"] = [
    {
      id: "relationship-signal-2",
      actorId: "ghost",
      targetActorId: "protagonist",
      signal: "tests the boundary",
      interpretation: "private suspicion",
      boundary: "do not render directly",
      sourceEventId: null,
      visibility: "secret",
    },
  ];
  assert.throws(
    () => parseStateSchema(raw),
    /非法secrets\.relationshipSignals\[\]\.actorId: actor ghost 不存在/,
  );

  section(raw, "public")["relationshipSignals"] = [
    {
      id: "relationship-signal-3",
      actorId: "protagonist",
      targetActorId: "protagonist",
      signal: "hesitates before answering",
      interpretation: "guarded concern",
      boundary: "do not overstate intimacy",
      sourceEventId: null,
      visibility: "secret",
    },
  ];
  section(raw, "secrets")["relationshipSignals"] = [];
  assert.throws(() => parseStateSchema(raw), /public\.relationshipSignals 只能包含 player-known/);
});

void test("parseStateSchema rejects overfilled faction clock", () => {
  const raw = rawState();
  const factionClocks = section(raw, "secrets")?.["factionClocks"];
  if (!Array.isArray(factionClocks)) {
    throw new Error("secrets.factionClocks must be an array");
  }
  factionClocks.push({
    id: "test-clock",
    factionId: "nighthawks",
    label: "值夜人行动",
    filled: 7,
    size: 6,
    visibility: "hidden",
  });

  assert.throws(() => parseStateSchema(raw), /filled\(7\) 不能大于 size\(6\)/);
});

void test("parseStateSchema rejects dangling purse owner", () => {
  const raw = rawState();
  const economy = section(section(raw, "public"), "economy");
  economy["accessibleFunds"] = [
    {
      id: "orphan-purse",
      ownerActorId: "no-such-actor",
      label: "孤儿钱包",
      amount: 100,
      access: "held",
    },
  ];

  assert.throws(() => parseStateSchema(raw), /purse\.ownerActorId: actor no-such-actor 不存在/);
});

void test("parseStateSchema rejects duplicate relationship signal IDs", () => {
  const raw = rawState();
  const publicState = section(raw, "public");
  publicState["relationshipSignals"] = [
    {
      id: "dup-signal",
      actorId: "protagonist",
      targetActorId: "protagonist",
      signal: "test",
      interpretation: "test",
      boundary: "test",
      sourceEventId: null,
      visibility: "player-known",
    },
    {
      id: "dup-signal",
      actorId: "protagonist",
      targetActorId: "protagonist",
      signal: "another",
      interpretation: "another",
      boundary: "another",
      sourceEventId: null,
      visibility: "player-known",
    },
  ];

  assert.throws(() => parseStateSchema(raw), /重复 relationship signal/);
});

function rawState(): Record<string, unknown> {
  const cloned: unknown = structuredClone(createInitialState());
  if (!isRecord(cloned)) {
    throw new Error("unreachable: state 必须是对象");
  }
  return cloned;
}

function section(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) {
    throw new Error(`unreachable: ${key} 必须是对象`);
  }
  return value;
}
