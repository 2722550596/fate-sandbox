import type { ActorAgendaState, ActorId, ActorKnowledgeLens, State } from "../state/state.ts";

import {
  deleteActorAgenda,
  deleteActorKnowledgeLens,
  getActorAgenda,
  getActorKnowledgeLens,
  setActorAgenda,
  setActorKnowledgeLens,
} from "./secret-actor-state.ts";

export type KnowledgeLensCategory = "knows" | "suspects" | "falseBeliefs" | "forbiddenKnowledge";

export interface UpsertActorAgendaInput {
  actorId: ActorId;
  goal: string;
  fear: string;
  currentAssignment: string | null;
  lastIndependentActionAt: string | null;
}

export interface UpsertActorKnowledgeLensInput {
  actorId: ActorId;
  knows: string[];
  suspects: string[];
  falseBeliefs: string[];
  forbiddenKnowledge: string[];
}

export function upsertActorAgenda(state: State, input: UpsertActorAgendaInput): ActorAgendaState {
  assertActorExists(state, input.actorId);
  const agenda = normalizeAgenda(input);
  setActorAgenda(state.secrets, input.actorId, agenda);
  return agenda;
}

export function markActorIndependentAction(
  state: State,
  actorId: ActorId,
  currentAssignment: string | null,
): ActorAgendaState {
  assertActorExists(state, actorId);
  const agenda = findActorAgenda(state, actorId);
  if (agenda === undefined) {
    throw new Error(
      `actor agenda ${actorId} 不存在；先用 update_actor_agenda kind=upsert 登记目标与恐惧。`,
    );
  }
  agenda.lastIndependentActionAt = state.public.clock.currentAt;
  agenda.currentAssignment = currentAssignment;
  return structuredClone(agenda);
}

export function clearActorAgenda(state: State, actorId: ActorId): ActorAgendaState {
  const agenda = getActorAgenda(state.secrets, actorId);
  if (agenda === undefined) {
    throw new Error(`actor agenda ${actorId} 不存在。`);
  }
  deleteActorAgenda(state.secrets, actorId);
  return agenda;
}

export function upsertActorKnowledgeLens(
  state: State,
  input: UpsertActorKnowledgeLensInput,
): ActorKnowledgeLens {
  assertActorExists(state, input.actorId);
  const lens = normalizeKnowledgeLens(input);
  setActorKnowledgeLens(state.secrets, input.actorId, lens);
  return lens;
}

export function recordActorKnowledgeFact(
  state: State,
  actorId: ActorId,
  category: KnowledgeLensCategory,
  fact: string,
): ActorKnowledgeLens {
  assertActorExists(state, actorId);
  const lens = ensureKnowledgeLens(state, actorId);
  const entries = lensEntries(lens, category);
  const normalizedFact = normalizeFact(fact, "fact");
  if (!entries.includes(normalizedFact)) {
    entries.push(normalizedFact);
  }
  return structuredClone(lens);
}

export function removeActorKnowledgeFact(
  state: State,
  actorId: ActorId,
  category: KnowledgeLensCategory,
  fact: string,
): ActorKnowledgeLens {
  const lens = findActorKnowledgeLens(state, actorId);
  if (lens === undefined) {
    throw new Error(`actor knowledge lens ${actorId} 不存在。`);
  }
  const entries = lensEntries(lens, category);
  const normalizedFact = normalizeFact(fact, "fact");
  const index = entries.indexOf(normalizedFact);
  if (index === -1) {
    throw new Error(
      `actor knowledge lens ${actorId} 的 ${category} 不含该 fact: ${normalizedFact}。`,
    );
  }
  entries.splice(index, 1);
  return structuredClone(lens);
}

export function clearActorKnowledgeLens(state: State, actorId: ActorId): ActorKnowledgeLens {
  const lens = getActorKnowledgeLens(state.secrets, actorId);
  if (lens === undefined) {
    throw new Error(`actor knowledge lens ${actorId} 不存在。`);
  }
  deleteActorKnowledgeLens(state.secrets, actorId);
  return lens;
}

function normalizeAgenda(input: UpsertActorAgendaInput): ActorAgendaState {
  return {
    actorId: input.actorId,
    goal: normalizeFact(input.goal, "goal"),
    fear: normalizeFact(input.fear, "fear"),
    currentAssignment:
      input.currentAssignment === null
        ? null
        : normalizeFact(input.currentAssignment, "currentAssignment"),
    lastIndependentActionAt: input.lastIndependentActionAt,
  };
}

function normalizeKnowledgeLens(input: UpsertActorKnowledgeLensInput): ActorKnowledgeLens {
  return {
    actorId: input.actorId,
    knows: uniqueFacts(input.knows, "knows"),
    suspects: uniqueFacts(input.suspects, "suspects"),
    falseBeliefs: uniqueFacts(input.falseBeliefs, "falseBeliefs"),
    forbiddenKnowledge: uniqueFacts(input.forbiddenKnowledge, "forbiddenKnowledge"),
  };
}

function uniqueFacts(values: readonly string[], fieldName: string): string[] {
  const out: string[] = [];
  for (const value of values) {
    const fact = normalizeFact(value, fieldName);
    if (!out.includes(fact)) {
      out.push(fact);
    }
  }
  return out;
}

function normalizeFact(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} 不能为空。`);
  }
  return trimmed;
}

function ensureKnowledgeLens(state: State, actorId: ActorId): ActorKnowledgeLens {
  const lens = findActorKnowledgeLens(state, actorId);
  if (lens !== undefined) {
    return lens;
  }
  const fresh = { actorId, knows: [], suspects: [], falseBeliefs: [], forbiddenKnowledge: [] };
  setActorKnowledgeLens(state.secrets, actorId, fresh);
  return fresh;
}

function findActorAgenda(state: State, actorId: ActorId): ActorAgendaState | undefined {
  return getActorAgenda(state.secrets, actorId);
}

function findActorKnowledgeLens(state: State, actorId: ActorId): ActorKnowledgeLens | undefined {
  return getActorKnowledgeLens(state.secrets, actorId);
}

function lensEntries(lens: ActorKnowledgeLens, category: KnowledgeLensCategory): string[] {
  switch (category) {
    case "knows":
      return lens.knows;
    case "suspects":
      return lens.suspects;
    case "falseBeliefs":
      return lens.falseBeliefs;
    case "forbiddenKnowledge":
      return lens.forbiddenKnowledge;
    default:
      throw new Error(`unknown knowledge lens category: ${String(category)}`);
  }
}

function assertActorExists(state: State, actorId: ActorId): void {
  if (state.public.actors[actorId] === undefined) {
    throw new Error(`actor ${actorId} 不存在。`);
  }
}
