import assert from "node:assert/strict";
import test from "node:test";

import {
  clearActorAgenda,
  clearActorKnowledgeLens,
  markActorIndependentAction,
  recordActorKnowledgeFact,
  removeActorKnowledgeFact,
  upsertActorAgenda,
  upsertActorKnowledgeLens,
} from "./actor-agenda.ts";
import { createInitialState } from "./state-store.ts";

const PROTAGONIST_ACTOR_ID = "protagonist";

void test("upsertActorAgenda creates and replaces an agenda for one actor", () => {
  const draft = createInitialState();

  const created = upsertActorAgenda(draft, {
    actorId: PROTAGONIST_ACTOR_ID,
    goal: " leave the gate ",
    fear: "being watched",
    currentOrder: null,
    lastIndependentActionAt: null,
  });
  const replaced = upsertActorAgenda(draft, {
    actorId: PROTAGONIST_ACTOR_ID,
    goal: "cross the street",
    fear: "losing time",
    currentOrder: "move now",
    lastIndependentActionAt: "2004-01-30T07:00:00.000Z",
  });

  assert.equal(created.goal, "leave the gate");
  assert.equal(replaced.currentOrder, "move now");
  assert.equal(Object.keys(draft.secrets.actorAgendas).length, 1);
  assert.equal(draft.secrets.actorAgendas[PROTAGONIST_ACTOR_ID]?.goal, "cross the street");
});

void test("markActorIndependentAction stamps current time on an existing agenda", () => {
  const draft = createInitialState();
  upsertActorAgenda(draft, {
    actorId: PROTAGONIST_ACTOR_ID,
    goal: "watch the road",
    fear: "ambush",
    currentOrder: "wait",
    lastIndependentActionAt: null,
  });

  const agenda = markActorIndependentAction(draft, PROTAGONIST_ACTOR_ID, "circle the gate");

  assert.equal(agenda.lastIndependentActionAt, draft.public.clock.currentAt);
  assert.equal(draft.secrets.actorAgendas[PROTAGONIST_ACTOR_ID]?.currentOrder, "circle the gate");
});

void test("agenda helpers reject missing actors and missing agendas", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      upsertActorAgenda(draft, {
        actorId: "ghost",
        goal: "watch",
        fear: "light",
        currentOrder: null,
        lastIndependentActionAt: null,
      }),
    /actor ghost 不存在/,
  );
  assert.throws(
    () => markActorIndependentAction(draft, PROTAGONIST_ACTOR_ID, null),
    /actor agenda/,
  );
  assert.throws(() => clearActorAgenda(draft, PROTAGONIST_ACTOR_ID), /不存在/);
});

void test("upsertActorKnowledgeLens dedupes fact lists and replaces by actor", () => {
  const draft = createInitialState();

  const lens = upsertActorKnowledgeLens(draft, {
    actorId: PROTAGONIST_ACTOR_ID,
    knows: ["school gate", " school gate "],
    suspects: ["tail"],
    falseBeliefs: [],
    forbiddenKnowledge: ["hidden true name"],
  });

  assert.deepEqual(lens.knows, ["school gate"]);
  assert.deepEqual(draft.secrets.actorKnowledgeLenses[PROTAGONIST_ACTOR_ID]?.forbiddenKnowledge, [
    "hidden true name",
  ]);

  upsertActorKnowledgeLens(draft, {
    actorId: PROTAGONIST_ACTOR_ID,
    knows: ["new fact"],
    suspects: [],
    falseBeliefs: [],
    forbiddenKnowledge: [],
  });

  assert.equal(Object.keys(draft.secrets.actorKnowledgeLenses).length, 1);
  assert.deepEqual(draft.secrets.actorKnowledgeLenses[PROTAGONIST_ACTOR_ID]?.knows, ["new fact"]);
});

void test("recordActorKnowledgeFact auto-creates a lens and removes exact facts", () => {
  const draft = createInitialState();

  recordActorKnowledgeFact(draft, PROTAGONIST_ACTOR_ID, "suspects", "someone is watching");
  recordActorKnowledgeFact(draft, PROTAGONIST_ACTOR_ID, "suspects", "someone is watching");
  recordActorKnowledgeFact(draft, PROTAGONIST_ACTOR_ID, "falseBeliefs", "the road is empty");

  assert.deepEqual(draft.secrets.actorKnowledgeLenses[PROTAGONIST_ACTOR_ID]?.suspects, [
    "someone is watching",
  ]);
  assert.deepEqual(draft.secrets.actorKnowledgeLenses[PROTAGONIST_ACTOR_ID]?.falseBeliefs, [
    "the road is empty",
  ]);

  removeActorKnowledgeFact(draft, PROTAGONIST_ACTOR_ID, "suspects", "someone is watching");

  assert.deepEqual(draft.secrets.actorKnowledgeLenses[PROTAGONIST_ACTOR_ID]?.suspects, []);
  assert.throws(
    () => removeActorKnowledgeFact(draft, PROTAGONIST_ACTOR_ID, "suspects", "someone is watching"),
    /不含该 fact/,
  );
});

void test("clearActorKnowledgeLens removes the actor lens", () => {
  const draft = createInitialState();
  recordActorKnowledgeFact(draft, PROTAGONIST_ACTOR_ID, "knows", "the gate is open");

  const removed = clearActorKnowledgeLens(draft, PROTAGONIST_ACTOR_ID);

  assert.equal(removed.actorId, PROTAGONIST_ACTOR_ID);
  assert.deepEqual(draft.secrets.actorKnowledgeLenses, {});
});
