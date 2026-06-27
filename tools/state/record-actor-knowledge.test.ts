import assert from "node:assert/strict";
import test from "node:test";

import { cloneState, resetState } from "../../engine/core/state/state-store.ts";

import { recordActorKnowledgeTool } from "./record-actor-knowledge.ts";

void test("recordActorKnowledgeTool adds and removes lens facts", () => {
  resetState();

  recordActorKnowledgeTool(
    {
      kind: "add-fact",
      actorId: "protagonist",
      category: "suspects",
      fact: "someone is watching the gate",
    },
    undefined,
  );
  recordActorKnowledgeTool(
    {
      kind: "add-fact",
      actorId: "protagonist",
      category: "forbiddenKnowledge",
      fact: "unrevealed true name",
    },
    undefined,
  );

  let lens = cloneState().secrets.actorStates["protagonist"]?.knowledgeLens;
  assert.deepEqual(lens?.suspects, ["someone is watching the gate"]);
  assert.deepEqual(lens?.forbiddenKnowledge, ["unrevealed true name"]);

  recordActorKnowledgeTool(
    {
      kind: "remove-fact",
      actorId: "protagonist",
      category: "suspects",
      fact: "someone is watching the gate",
    },
    undefined,
  );

  lens = cloneState().secrets.actorStates["protagonist"]?.knowledgeLens;
  assert.deepEqual(lens?.suspects, []);
});

void test("recordActorKnowledgeTool replaces and clears a lens", () => {
  resetState();

  recordActorKnowledgeTool(
    {
      kind: "upsert-lens",
      actorId: "protagonist",
      knows: ["the road is blocked"],
      suspects: ["tail"],
      falseBeliefs: ["the school is empty"],
      forbiddenKnowledge: ["hidden noble phantasm"],
      reason: "setup current lens",
    },
    undefined,
  );

  const lens = cloneState().secrets.actorStates["protagonist"]?.knowledgeLens;
  assert.equal(lens?.knows[0], "the road is blocked");

  const result = recordActorKnowledgeTool(
    { kind: "clear", actorId: "protagonist", reason: "actor exited tracking" },
    undefined,
  );

  assert.match(result.content[0]?.text ?? "", /已清除/);
  assert.deepEqual(cloneState().secrets.actorStates, {});
});
