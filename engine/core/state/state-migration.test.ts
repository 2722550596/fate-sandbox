import assert from "node:assert/strict";
import test from "node:test";

import { cloneState, hydrateState, migrateState, createInitialState } from "./state-store.ts";
import { CURRENT_STATE_SCHEMA_VERSION } from "./state.ts";

void test("migrateState passes through a v1 LOTM state unchanged", () => {
  const current = createInitialState();
  const rawV1 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 1 },
  };

  const migrated = migrateState(rawV1);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.equal(migrated.public.clock.currentAt, current.public.clock.currentAt);
  assert.deepEqual(migrated.public.turnLog, []);
  assert.deepEqual(migrated.public.obligations, []);
  assert.deepEqual(migrated.secrets.offscreenEventLog, []);
  assert.deepEqual(migrated.secrets.backstageObligations, []);
});

void test("hydrateState accepts session-wrapped v1 LOTM state", () => {
  const current = createInitialState();
  const rawV1 = {
    ...current,
    meta: { ...current.meta, schemaVersion: 1 },
  };

  hydrateState({ v: 1, turn: 0, state: rawV1 });

  const hydrated = cloneState();
  assert.equal(hydrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.deepEqual(hydrated.public.turnLog, []);
  assert.deepEqual(hydrated.public.obligations, []);
});

void test("migrateState sets default offscreenEventLog when missing", () => {
  const current = createInitialState();
  const { offscreenEventLog: _log, ...secretsWithout } = current.secrets;
  const raw = {
    ...current,
    meta: { ...current.meta, schemaVersion: 1 },
    secrets: secretsWithout,
  };

  const migrated = migrateState(raw);

  assert.equal(migrated.meta.schemaVersion, CURRENT_STATE_SCHEMA_VERSION);
  assert.deepEqual(migrated.secrets.offscreenEventLog, []);
});

void test("migrateState rejects unknown schema versions", () => {
  const current = createInitialState();
  const raw = {
    ...current,
    meta: { ...current.meta, schemaVersion: 999 },
  };

  assert.throws(() => migrateState(raw), {
    message: /不支持的 state schemaVersion: 999/,
  });
});
