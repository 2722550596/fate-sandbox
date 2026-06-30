import type {
  ActorId,
  PublicActorState,
  PublicGameState,
  State,
  TagEntry,
} from "../state/state.ts";
import type {
  ActorRegistryInput,
  PublicNpcInput,
  PublicNpcSkeletonInput,
  RetireActorInput,
  ScenePresenceInput,
} from "./actor-schema.ts";

import { assertNonEmptyString } from "../utils/typebox-validation.ts";
import { deleteSecretActorState } from "./secret-actor-state.ts";

export interface UpsertActorInput {
  actor: PublicActorState;
  reason: string;
}

export type { ActorRegistryInput, PublicNpcInput, PublicNpcSkeletonInput } from "./actor-schema.ts";

export interface UpsertActorResult {
  message: string;
}

export function setScenePresence(draft: State, input: ScenePresenceInput): ScenePresenceResult {
  assertNonEmptyString(input.reason, "reason");
  assertKnownActors(draft.public.actors, input.presentActorIds, "presentActorIds");
  assertKnownActors(draft.public.actors, input.allyActorIds, "allyActorIds");
  for (const allyId of input.allyActorIds) {
    if (!input.presentActorIds.includes(allyId)) {
      throw new Error(
        `allyActorIds 必须都是 presentActorIds 的子集：${allyId} 不在 presentActorIds 中。`,
      );
    }
  }
  draft.public.scene.presentActorIds = uniqueActorIds(input.presentActorIds);
  draft.public.allyActorIds = uniqueActorIds(input.allyActorIds);
  return { message: "场景在场 actor 已更新。" };
}

export interface ScenePresenceResult {
  message: string;
}

export type { ScenePresenceInput } from "./actor-schema.ts";

export type { RetireActorInput } from "./actor-schema.ts";

export interface RetireActorResult {
  message: string;
}

export function upsertActor(draft: State, input: ActorRegistryInput): UpsertActorResult {
  switch (input.kind) {
    case "setup-protagonist":
      return upsertProtagonist(draft, input);
    case "upsert-public-npc":
      return upsertPublicNpc(draft, input);
    case "init-npc":
      return initNpc(draft, input);
    case "upsert-sequence":
      return upsertSequence(draft, input);
    default:
      throw new Error("unreachable actor registry input kind");
  }
}

function upsertProtagonist(
  draft: State,
  input: Extract<ActorRegistryInput, { kind: "setup-protagonist" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  if (input.actor.id !== draft.public.protagonistActorId) {
    throw new Error("setup-protagonist 只能写入当前 protagonistActorId 指向的 actor。");
  }
  writeActor(draft, input.actor);
  return { message: `actor 已写入：${input.actor.id}。` };
}

function upsertPublicNpc(
  draft: State,
  input: Extract<ActorRegistryInput, { kind: "upsert-public-npc" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  const actor = toSafePublicActor(input.npc);
  writeActor(draft, actor);
  return { message: `public npc 已写入：${actor.id}。` };
}

function initNpc(
  draft: State,
  input: Extract<ActorRegistryInput, { kind: "init-npc" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  const actor = toInitNpcActor(input.npc);
  if (draft.public.actors[actor.id] !== undefined) {
    return { message: `actor 已存在：${actor.id}。` };
  }
  draft.public.actors[actor.id] = actor;
  return { message: `public npc skeleton 已写入：${actor.id}。` };
}

function upsertSequence(
  draft: State,
  input: Extract<ActorRegistryInput, { kind: "upsert-sequence" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  const seq = input.sequence;
  assertNonEmptyString(seq.actorId, "sequence.actorId");

  const actor = draft.public.actors[seq.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在，无法设置序列: ${seq.actorId}。`);
  }

  actor.sequence = {
    currentSequence: seq.currentSequence,
    rank: seq.rank,
    pathway: seq.pathway,
    promotionSystem: seq.promotionSystem ?? "potion",
    tags: resolveSequenceTagsForActor(seq.currentSequence),
    actingCues: [],
  };

  return {
    message: `序列已更新：${seq.actorId} → ${seq.currentSequence} (${seq.pathway})。`,
  };
}

export function retireActor(draft: State, input: RetireActorInput): RetireActorResult {
  const actorId = assertNonEmptyString(input.actorId, "actorId");
  assertNonEmptyString(input.reason, "reason");
  if (actorId === draft.public.protagonistActorId) {
    throw new Error("不能 retire protagonist。");
  }
  const actor = draft.public.actors[actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在，无法 retire: ${actorId}。`);
  }
  assertActorHasNoBlockingReferences(draft.public, actorId);
  removeActorEverywhere(draft, actorId);
  return { message: `actor 已退场并从当前 registry 移除：${actorId}。` };
}

export function removeActorEverywhere(draft: State, actorId: ActorId): void {
  delete draft.public.actors[actorId];
  delete draft.public.actorImpressions[actorId];
  deleteSecretActorState(draft.secrets, actorId);
  draft.public.scene.presentActorIds = draft.public.scene.presentActorIds.filter(
    (presentActorId) => presentActorId !== actorId,
  );
  draft.public.allyActorIds = draft.public.allyActorIds.filter(
    (allyActorId) => allyActorId !== actorId,
  );
  draft.public.relationshipSignals = draft.public.relationshipSignals.filter(
    (signal) => signal.actorId !== actorId && signal.targetActorId !== actorId,
  );
  draft.secrets.relationshipSignals = draft.secrets.relationshipSignals.filter(
    (signal) => signal.actorId !== actorId && signal.targetActorId !== actorId,
  );
}

function resolveSequenceTagsForActor(_sequenceName: string): TagEntry[] {
  return [];
}

function assertActorHasNoBlockingReferences(publicState: PublicGameState, actorId: ActorId): void {
  for (const [itemId, item] of Object.entries(publicState.trackedItems)) {
    if (item.ownerActorId === actorId || item.holderActorId === actorId) {
      throw new Error(`actor ${actorId} 仍持有/拥有 tracked item ${itemId}；请先转移或结算物品。`);
    }
  }
  for (const purse of publicState.economy.accessibleFunds) {
    if (purse.ownerActorId === actorId) {
      throw new Error(`actor ${actorId} 仍拥有资金账户 ${purse.id}；请先转移或结算资金。`);
    }
  }
  for (const debt of publicState.economy.debts) {
    if (debt.debtorActorId === actorId) {
      throw new Error(`actor ${actorId} 仍背负债务 ${debt.id}；请先结算或免除债务。`);
    }
  }
}

function writeActor(draft: State, actor: PublicActorState): void {
  draft.public.actors[actor.id] = actor;
}

function toSafePublicActor(npc: PublicNpcInput): PublicActorState {
  const base = {
    id: assertNonEmptyString(npc.id, "npc.id"),
    sequence: null,

    identity: {
      publicIdentity: assertNonEmptyString(npc.publicIdentity, "npc.publicIdentity"),
      background: assertNonEmptyString(npc.publicIdentity, "npc.publicIdentity"),
      roles: [],
      lockedFacts: [],
    },
    presentation: {
      canonicalName: assertNonEmptyString(npc.canonicalName, "npc.canonicalName"),
      renderName: assertNonEmptyString(npc.renderName ?? npc.canonicalName, "npc.renderName"),
      apparentAge: assertNonEmptyString(npc.apparentAge, "npc.apparentAge"),
      outfit: npc.outfit,
      demeanor: assertNonEmptyString(npc.demeanor, "npc.demeanor"),
    },
    condition: { afflictions: [] },
    inventory: { items: npc.ordinaryItems ?? [] },
    abilities: [],
    relationshipToProtagonist: npc.relationshipToProtagonist,
  };

  switch (npc.kind) {
    case "human":
      return { ...base, kind: "human" };
    case "beyonder":
      return { ...base, kind: "beyonder" };
    case "creature":
      return { ...base, kind: "creature", origin: "玩家可见信息未确认" };
    case "other":
      return { ...base, kind: "other", nature: "玩家可见信息未确认" };
    default:
      throw new Error("unreachable public npc kind");
  }
}

function toInitNpcActor(npc: PublicNpcSkeletonInput): PublicActorState {
  return toSafePublicActor({
    id: npc.actorId,
    kind: npc.npcKind ?? "human",
    canonicalName: npc.canonicalName,
    renderName: npc.renderName,
    publicIdentity: npc.publicIdentity,
    apparentAge: npc.apparentAge ?? "玩家可见年龄未确认",
    outfit: npc.outfit ?? {
      label: "玩家可见外观未确认",
      details: "玩家可见外观未确认",
    },
    demeanor: npc.demeanor ?? "玩家可见举止未确认",
    relationshipToProtagonist: npc.relationshipToProtagonist ?? {
      stance: "neutral",
      summary: "尚未建立关系。",
    },
    ordinaryItems: npc.ordinaryItems ?? [],
  });
}

function assertKnownActors(
  actors: Readonly<Record<ActorId, unknown>>,
  actorIds: readonly ActorId[],
  fieldName: string,
): void {
  for (const actorId of actorIds) {
    if (actors[actorId] === undefined) {
      throw new Error(`${fieldName} 包含不存在的 actor: ${actorId}`);
    }
  }
}

function uniqueActorIds(actorIds: readonly ActorId[]): ActorId[] {
  return [...new Set(actorIds.map((actorId) => assertNonEmptyString(actorId, "actorId")))];
}
