import assert from "node:assert/strict";
import test from "node:test";

import { upsertActor } from "./actor.ts";
import { parseStateSchema } from "./state-schema.ts";
import { createInitialState } from "./state-store.ts";
import { isRecord } from "./typebox-validation.ts";

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

void test("parseStateSchema rejects orphan actorSecrets without a matching actor", () => {
  const raw = rawState();
  section(section(raw, "secrets"), "actorSecrets")["ghost"] = {
    actorId: "ghost",
    hiddenNoblePhantasms: [],
    privateMotives: [],
    unrevealedAffiliations: [],
  };

  assert.throws(() => parseStateSchema(raw), /非法actorSecrets key: actor ghost 不存在/);
});

void test("parseStateSchema validates actor agenda actor refs and uniqueness", () => {
  const raw = rawState();
  section(raw, "secrets")["actorAgendas"] = [
    {
      actorId: "protagonist",
      goal: "leave the school gate",
      fear: "being watched",
      currentOrder: null,
      lastIndependentActionAt: null,
    },
    {
      actorId: "protagonist",
      goal: "duplicate",
      fear: "duplicate",
      currentOrder: null,
      lastIndependentActionAt: null,
    },
  ];

  assert.throws(() => parseStateSchema(raw), /重复 actor agenda: protagonist/);

  section(raw, "secrets")["actorAgendas"] = [
    {
      actorId: "ghost",
      goal: "watch",
      fear: "light",
      currentOrder: null,
      lastIndependentActionAt: null,
    },
  ];
  assert.throws(() => parseStateSchema(raw), /非法actorAgendas\[\]\.actorId: actor ghost 不存在/);
});

void test("parseStateSchema validates actor knowledge lens actor refs and uniqueness", () => {
  const raw = rawState();
  section(raw, "secrets")["actorKnowledgeLenses"] = [
    {
      actorId: "protagonist",
      knows: ["A"],
      suspects: [],
      falseBeliefs: [],
      forbiddenKnowledge: [],
    },
    {
      actorId: "protagonist",
      knows: ["B"],
      suspects: [],
      falseBeliefs: [],
      forbiddenKnowledge: [],
    },
  ];

  assert.throws(() => parseStateSchema(raw), /重复 actor knowledge lens: protagonist/);

  section(raw, "secrets")["actorKnowledgeLenses"] = [
    { actorId: "ghost", knows: [], suspects: [], falseBeliefs: [], forbiddenKnowledge: [] },
  ];
  assert.throws(
    () => parseStateSchema(raw),
    /非法actorKnowledgeLenses\[\]\.actorId: actor ghost 不存在/,
  );
});

void test("parseStateSchema normalizes actor agenda independent-action time", () => {
  const raw = rawState();
  section(raw, "secrets")["actorAgendas"] = [
    {
      actorId: "protagonist",
      goal: "cross the gate",
      fear: "being noticed",
      currentOrder: "move",
      lastIndependentActionAt: "2004-01-30T16:00:00+09:00",
    },
  ];

  const parsed = parseStateSchema(raw);

  assert.equal(parsed.secrets.actorAgendas[0]?.lastIndependentActionAt, "2004-01-30T07:00:00.000Z");
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

void test("parseStateSchema rejects dangling contractedServantIds", () => {
  const raw = rawState();
  const protagonist = section(section(section(raw, "public"), "actors"), "protagonist");
  protagonist["roles"] = [
    {
      kind: "master",
      commandSpells: { total: 3, remaining: 3 },
      contractedServantIds: ["no-such-servant"],
    },
  ];

  assert.throws(
    () => parseStateSchema(raw),
    /非法actors\.protagonist contractedServantIds\[\]: actor no-such-servant 不存在/,
  );
});

void test("parseStateSchema rejects dangling servant contract masterActorId", () => {
  const draft = createInitialState();
  upsertActor(draft, {
    kind: "upsert-servant",
    servant: {
      id: "caster",
      internalName: "Caster",
      publicIdentity: "柳洞寺驻留的从者",
      apparentAge: "不明",
      outfit: { label: "深紫色长袍与兜帽", details: "遮住面容" },
      demeanor: "谨慎、孤高",
      className: "Caster",
      trueNameDisplay: "Caster",
      trueNameStatus: "hidden",
      parameters: {
        strength: "E",
        endurance: "D",
        agility: "C",
        mana: "A+",
        luck: "B",
        noblePhantasm: "C",
      },
      classSkills: [],
      personalSkills: [],
      noblePhantasms: [],
      spiritualCore: 100,
      mana: 90,
      spiritualCondition: "完好",
      masterActorId: null,
      masterName: null,
      contractStatus: "masterless",
      manaSupply: "sufficient",
      currentOrder: "守卫柳洞寺山门",
    },
    reason: "测试悬空 master 引用",
  });
  const caster = draft.public.actors["caster"];
  assert.ok(caster?.servantForm);
  caster.servantForm.contract.masterActorId = "no-such-master";

  assert.throws(
    () => parseStateSchema(draft),
    /非法actors\.caster servantForm\.contract\.masterActorId: actor no-such-master 不存在/,
  );
});

void test("parseStateSchema rejects command spells with remaining above total", () => {
  const raw = rawState();
  const protagonist = section(section(section(raw, "public"), "actors"), "protagonist");
  protagonist["roles"] = [
    { kind: "master", commandSpells: { total: 3, remaining: 5 }, contractedServantIds: [] },
  ];

  assert.throws(() => parseStateSchema(raw), /remaining 不能大于 total/);
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
