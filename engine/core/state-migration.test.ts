import assert from "node:assert/strict";
import test from "node:test";

import { cloneState, hydrateState, migrateState, createInitialState } from "./state-store.ts";
import { CURRENT_STATE_SCHEMA_VERSION } from "./state.ts";

// pre-v11 存档的 presentation 只有 displayName（无 renderName / internalName）。
// 这些测试从 createInitialState()（当前形态）派生，需要把名字字段降级回旧形态，
// 才能忠实驱动 v10→v11→v12 迁移链。
function legacyActors(current: ReturnType<typeof createInitialState>): Record<string, unknown> {
  const actors: Record<string, unknown> = {};
  for (const [id, actor] of Object.entries(current.public.actors)) {
    const { renderName: _renderName, internalName, ...rest } = actor.presentation;
    actors[id] = { ...actor, presentation: { ...rest, displayName: internalName } };
  }
  return actors;
}

void test("migrateState upgrades schema v1 states to current turn log shape", () => {
  const current = createInitialState();
  const { turnLog: _turnLog, obligations: _obligations, ...publicV1 } = current.public;
  const rawV1 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 1 },
    public: { ...publicV1, actors: legacyActors(current) },
  };

  const migrated = migrateState(rawV1);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.deepEqual(migrated.public.turnLog, []);
  assert.deepEqual(migrated.public.obligations, []);
  assert.equal(migrated.public.clock.currentAt, current.public.clock.currentAt);
});

void test("migrateState drops schema v2 non-advancing turn log entries", () => {
  const current = createInitialState();
  const { obligations: _obligations, ...publicV2 } = current.public;
  const rawV2 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 2 },
    public: {
      ...publicV2,
      actors: legacyActors(current),
      turnLog: [
        {
          id: "turn-1",
          summary: "旧 none turn",
          startedAt: current.public.clock.currentAt,
          endedAt: current.public.clock.currentAt,
          time: { kind: "none", reason: "旧 schema 允许不推进时间" },
          eventCount: 1,
          resultCount: 1,
        },
        {
          id: "turn-2",
          summary: "旧 elapsed turn",
          startedAt: current.public.clock.currentAt,
          endedAt: "2004-01-30T07:01:00.000Z",
          time: { kind: "elapsed", elapsedMinutes: 1, reason: "保留推进时间记录" },
          eventCount: 1,
          resultCount: 1,
        },
      ],
    },
  };

  const migrated = migrateState(rawV2);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.equal(migrated.public.turnLog.length, 1);
  assert.equal(migrated.public.turnLog[0]?.id, "turn-2");
});

void test("hydrateState accepts session-wrapped schema v1 states through migration", () => {
  const current = createInitialState();
  const { turnLog: _turnLog, obligations: _obligations, ...publicV1 } = current.public;
  const rawV1 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 1 },
    public: { ...publicV1, actors: legacyActors(current) },
  };

  hydrateState({ v: 1, turn: 0, state: rawV1 });

  const hydrated = cloneState();
  assert.equal(hydrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.deepEqual(hydrated.public.turnLog, []);
  assert.deepEqual(hydrated.public.obligations, []);
});

void test("migrateState upgrades schema v3 states with an empty obligations ledger", () => {
  const current = createInitialState();
  const { obligations: _obligations, ...publicV3 } = current.public;
  const rawV3 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 3 },
    public: { ...publicV3, actors: legacyActors(current) },
  };

  const migrated = migrateState(rawV3);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.deepEqual(migrated.public.obligations, []);
  assert.deepEqual(migrated.secrets.factionClocks, []);
  assert.deepEqual(migrated.secrets.scheduledEvents, []);
});

void test("migrateState upgrades schema v4 states with empty clock ledgers", () => {
  const current = createInitialState();
  const { factionClocks: _clocks, scheduledEvents: _events, ...secretsV4 } = current.secrets;
  const rawV4 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 4 },
    public: { ...current.public, actors: legacyActors(current) },
    secrets: secretsV4,
  };

  const migrated = migrateState(rawV4);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.deepEqual(migrated.secrets.factionClocks, []);
  assert.deepEqual(migrated.secrets.scheduledEvents, []);
  assert.deepEqual(migrated.public.hooks, []);
});

void test("migrateState upgrades schema v5 states with an empty hook ledger", () => {
  const current = createInitialState();
  const { hooks: _hooks, ...publicV5 } = current.public;
  const rawV5 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 5 },
    public: { ...publicV5, actors: legacyActors(current) },
  };

  const migrated = migrateState(rawV5);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.deepEqual(migrated.public.hooks, []);
  assert.deepEqual(migrated.secrets.actorAgendas, {});
  assert.deepEqual(migrated.secrets.actorKnowledgeLenses, {});
});

void test("migrateState upgrades schema v6 states with empty actor autonomy ledgers", () => {
  const current = createInitialState();
  const { actorAgendas: _agendas, actorKnowledgeLenses: _lenses, ...secretsV6 } = current.secrets;
  const rawV6 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 6 },
    public: { ...current.public, actors: legacyActors(current) },
    secrets: secretsV6,
  };

  const migrated = migrateState(rawV6);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.deepEqual(migrated.secrets.actorAgendas, {});
  assert.deepEqual(migrated.secrets.actorKnowledgeLenses, {});
  assert.deepEqual(migrated.public.relationshipSignals, []);
  assert.deepEqual(migrated.secrets.relationshipSignals, []);
});

void test("migrateState upgrades schema v7 states with empty relationship signal ledgers", () => {
  const current = createInitialState();
  const { relationshipSignals: _publicSignals, ...publicV7 } = current.public;
  const { relationshipSignals: _secretSignals, ...secretsV7 } = current.secrets;
  const rawV7 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 7 },
    public: { ...publicV7, actors: legacyActors(current) },
    secrets: secretsV7,
  };

  const migrated = migrateState(rawV7);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.deepEqual(migrated.public.relationshipSignals, []);
  assert.deepEqual(migrated.secrets.relationshipSignals, []);
});

void test("migrateState upgrades v8 to v9 with actorImpressions", () => {
  const current = createInitialState();
  const { actorImpressions: _impressions, ...publicV8 } = current.public;
  const rawV8 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 8 },
    public: { ...publicV8, actors: legacyActors(current) },
  };

  const migrated = migrateState(rawV8);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.deepEqual(migrated.public.actorImpressions, {});
});

void test("migrateState upgrades v10 through v12: renderName copied, displayName renamed to internalName", () => {
  const current = createInitialState();
  const actor = current.public.actors.protagonist;
  if (actor === undefined) {
    throw new Error("expected protagonist");
  }
  const { renderName: _renderName, internalName, ...rest } = actor.presentation;
  const presentationV10 = { ...rest, displayName: internalName };
  const rawV10 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 10 },
    public: {
      ...current.public,
      actors: {
        ...current.public.actors,
        protagonist: {
          ...actor,
          presentation: presentationV10,
        },
      },
    },
  };

  const migrated = migrateState(rawV10);
  const presentation = migrated.public.actors.protagonist?.presentation;
  assert.ok(presentation);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.equal(presentation.renderName, "你");
  assert.equal(presentation.internalName, "你");
  assert.ok(!Object.hasOwn(presentation, "displayName"));
});

void test("migrateState upgrades v11 to v12 by renaming displayName to internalName", () => {
  const current = createInitialState();
  const actor = current.public.actors.protagonist;
  if (actor === undefined) {
    throw new Error("expected protagonist");
  }
  const { internalName, ...rest } = actor.presentation;
  const presentationV11 = { ...rest, displayName: internalName };
  const rawV11 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 11 },
    public: {
      ...current.public,
      actors: {
        ...current.public.actors,
        protagonist: {
          ...actor,
          presentation: presentationV11,
        },
      },
    },
  };

  const migrated = migrateState(rawV11);
  const presentation = migrated.public.actors.protagonist?.presentation;
  assert.ok(presentation);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.equal(presentation.internalName, "你");
  assert.ok(!Object.hasOwn(presentation, "displayName"));
});

void test("migrateState upgrades v12 to v13 by indexing per-actor side tables on actorId", () => {
  const current = createInitialState();
  const agenda = {
    actorId: "protagonist",
    goal: "cross the gate",
    fear: "being watched",
    currentOrder: null,
    lastIndependentActionAt: null,
  };
  const lens = {
    actorId: "protagonist",
    knows: ["the gate is open"],
    suspects: [],
    falseBeliefs: [],
    forbiddenKnowledge: [],
  };
  const impression = {
    actorId: "protagonist",
    presence: "steady",
    actionStyle: "direct",
    relationshipPosture: "self",
    voiceMaterial: "",
    updatedAt: current.public.clock.currentAt,
  };
  const rawV12 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 12 },
    public: { ...current.public, actorImpressions: [impression] },
    secrets: { ...current.secrets, actorAgendas: [agenda], actorKnowledgeLenses: [lens] },
  };

  const migrated = migrateState(rawV12);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.deepEqual(migrated.secrets.actorAgendas, { protagonist: agenda });
  assert.deepEqual(migrated.secrets.actorKnowledgeLenses, { protagonist: lens });
  assert.deepEqual(migrated.public.actorImpressions, { protagonist: impression });
});
