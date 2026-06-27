import type {
  ActorId,
  RelationshipSignal,
  RelationshipSignalVisibility,
  State,
} from "../state/state.ts";

import { allActorSecretSlots } from "../actor/secret-actor-state.ts";
import { createId } from "./ids.ts";
import { assertNonEmptyString, isRecord } from "./typebox-validation.ts";

export interface RecordRelationshipSignalInput {
  actorId: ActorId;
  targetActorId: ActorId;
  signal: string;
  interpretation: string;
  boundary: string;
  sourceEventId: string | null;
  visibility: RelationshipSignalVisibility;
}

const RELATIONSHIP_SIGNAL_ID_PREFIX = "relationship-signal";

export function recordRelationshipSignal(
  draft: State,
  input: RecordRelationshipSignalInput,
): RelationshipSignal {
  const signal = buildRelationshipSignal(draft, input);
  assertPlayerKnownSignalIsSafe(draft, signal);
  if (signal.visibility === "player-known") {
    draft.public.relationshipSignals.push(signal);
  } else {
    draft.secrets.relationshipSignals.push(signal);
  }
  return structuredClone(signal);
}

export function recentPlayerKnownRelationshipSignals(
  publicState: { relationshipSignals: RelationshipSignal[] },
  limit: number,
): RelationshipSignal[] {
  return publicState.relationshipSignals.slice(-limit).map((signal) => structuredClone(signal));
}

function buildRelationshipSignal(
  draft: State,
  input: RecordRelationshipSignalInput,
): RelationshipSignal {
  assertActorExists(draft, input.actorId);
  assertActorExists(draft, input.targetActorId);
  return {
    id: createId(draft, RELATIONSHIP_SIGNAL_ID_PREFIX),
    actorId: input.actorId,
    targetActorId: input.targetActorId,
    signal: assertNonEmptyString(input.signal, "signal"),
    interpretation: assertNonEmptyString(input.interpretation, "interpretation"),
    boundary: assertNonEmptyString(input.boundary, "boundary"),
    sourceEventId:
      input.sourceEventId === null
        ? null
        : assertNonEmptyString(input.sourceEventId, "sourceEventId"),
    visibility: input.visibility,
  };
}

function assertPlayerKnownSignalIsSafe(draft: State, signal: RelationshipSignal): void {
  if (signal.visibility !== "player-known") {
    return;
  }
  const text = [signal.signal, signal.interpretation, signal.boundary].join("\n");
  const leaked = collectUnrevealedSecretStrings(draft).find((secret) => text.includes(secret));
  if (leaked !== undefined) {
    throw new Error(
      `player-known relationship signal 不能包含未揭示秘密字符串：${leaked}。请改用 visibility=secret，或先 reveal_secret。`,
    );
  }
}

function collectUnrevealedSecretStrings(state: State): string[] {
  const out = new Set<string>();
  for (const slots of allActorSecretSlots(state.secrets)) {
    const pathwaySecret = readUnrevealedValue(slots.pathwaySecret, pickString);
    if (pathwaySecret !== undefined) out.add(pathwaySecret);
    const sequenceSecret = readUnrevealedValue(slots.sequenceSecret, pickString);
    if (sequenceSecret !== undefined) out.add(sequenceSecret);
    for (const motive of slots.privateMotives) {
      const value = readUnrevealedValue(motive, pickString);
      if (value !== undefined) out.add(value);
    }
    for (const affiliation of slots.unrevealedAffiliations) {
      const value = readUnrevealedValue(affiliation, pickString);
      if (value !== undefined) out.add(value);
    }
  }
  return [...out];
}

function readUnrevealedValue(
  slot: unknown,
  pick: (value: unknown) => string | undefined,
): string | undefined {
  if (!isRecord(slot)) return undefined;
  if (slot["revealState"] === "revealed") return undefined;
  return pick(slot["value"]);
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function assertActorExists(state: State, actorId: ActorId): void {
  if (state.public.actors[actorId] === undefined) {
    throw new Error(`actor ${actorId} 不存在。`);
  }
}
