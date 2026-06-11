import assert from "node:assert/strict";
import test from "node:test";

import { cloneState, hydrateState, migrateState, createInitialState } from "./state-store.ts";

void test("migrateState upgrades schema v1 states to current turn log shape", () => {
  const current = createInitialState();
  const { turnLog: _turnLog, obligations: _obligations, ...publicV1 } = current.public;
  const rawV1 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 1 },
    public: publicV1,
  };

  const migrated = migrateState(rawV1);

  assert.equal(migrated.meta.schemaVersion, 5);
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

  assert.equal(migrated.meta.schemaVersion, 5);
  assert.equal(migrated.public.turnLog.length, 1);
  assert.equal(migrated.public.turnLog[0]?.id, "turn-2");
});

void test("hydrateState accepts session-wrapped schema v1 states through migration", () => {
  const current = createInitialState();
  const { turnLog: _turnLog, obligations: _obligations, ...publicV1 } = current.public;
  const rawV1 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 1 },
    public: publicV1,
  };

  hydrateState({ v: 1, turn: 0, state: rawV1 });

  const hydrated = cloneState();
  assert.equal(hydrated.meta.schemaVersion, 5);
  assert.deepEqual(hydrated.public.turnLog, []);
  assert.deepEqual(hydrated.public.obligations, []);
});

void test("migrateState upgrades schema v3 states with an empty obligations ledger", () => {
  const current = createInitialState();
  const { obligations: _obligations, ...publicV3 } = current.public;
  const rawV3 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 3 },
    public: publicV3,
  };

  const migrated = migrateState(rawV3);

  assert.equal(migrated.meta.schemaVersion, 5);
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
    secrets: secretsV4,
  };

  const migrated = migrateState(rawV4);

  assert.equal(migrated.meta.schemaVersion, 5);
  assert.deepEqual(migrated.secrets.factionClocks, []);
  assert.deepEqual(migrated.secrets.scheduledEvents, []);
});
