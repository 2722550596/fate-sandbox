import assert from "node:assert/strict";
import test from "node:test";

import { cloneState, resetState } from "../../core/state/state-store.ts";
import { recordRelationshipSignalTool } from "./record-relationship-signal.ts";

void test("recordRelationshipSignalTool writes player-known and secret ledgers", () => {
  resetState();

  const publicResult = recordRelationshipSignalTool(
    {
      actorId: "protagonist",
      targetActorId: "protagonist",
      signal: "she changes the subject before the apology",
      interpretation: "guarded concern",
      boundary: "not a confession",
      visibility: "player-known",
    },
    undefined,
  );
  recordRelationshipSignalTool(
    {
      actorId: "protagonist",
      targetActorId: "protagonist",
      signal: "she checks whether the family name lands",
      interpretation: "private test",
      boundary: "do not render the test directly",
      sourceEventId: "event-1",
      visibility: "secret",
    },
    undefined,
  );

  const state = cloneState();
  assert.match(publicResult.content[0]?.text ?? "", /关系信号已记账/);
  assert.equal(state.public.relationshipSignals[0]?.id, "relationship-signal-1");
  assert.equal(state.secrets.relationshipSignals[0]?.id, "relationship-signal-2");
  assert.equal(state.secrets.relationshipSignals[0]?.sourceEventId, "event-1");
});

void test("recordRelationshipSignalTool rejects invalid visibility and actors", () => {
  resetState();

  assert.throws(
    () =>
      recordRelationshipSignalTool(
        {
          actorId: "protagonist",
          targetActorId: "protagonist",
          signal: "pause",
          interpretation: "concern",
          boundary: "not confession",
          visibility: "public",
        },
        undefined,
      ),
    /visibility 必须是允许值之一/,
  );

  assert.throws(
    () =>
      recordRelationshipSignalTool(
        {
          actorId: "ghost",
          targetActorId: "protagonist",
          signal: "pause",
          interpretation: "concern",
          boundary: "not confession",
          visibility: "player-known",
        },
        undefined,
      ),
    /actor ghost 不存在/,
  );
});
