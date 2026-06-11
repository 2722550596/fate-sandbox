import assert from "node:assert/strict";
import test from "node:test";

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
