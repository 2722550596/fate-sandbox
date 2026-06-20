import type {
  ActorRegistryInput,
  PublicNpcInput,
  PublicNpcSkeletonInput,
  RetireActorInput,
  ScenePresenceInput,
  ServantInput,
} from "./actor-schema.ts";
import type { ActorId, PublicActorState, PublicGameState, State } from "./state.ts";

import { assertNonEmptyString } from "./typebox-validation.ts";

export interface UpsertActorInput {
  actor: PublicActorState;
  reason: string;
}

export type {
  ActorRegistryInput,
  PublicNpcInput,
  PublicNpcSkeletonInput,
  ServantInput,
} from "./actor-schema.ts";

export interface UpsertActorResult {
  message: string;
}

export function setScenePresence(draft: State, input: ScenePresenceInput): ScenePresenceResult {
  assertNonEmptyString(input.reason, "reason");
  assertKnownActors(draft.public.actors, input.presentActorIds, "presentActorIds");
  assertKnownActors(draft.public.actors, input.allyActorIds, "allyActorIds");
  draft.public.scene.presentActorIds = uniqueActorIds(input.presentActorIds);
  draft.public.allyActorIds = uniqueActorIds(input.allyActorIds);
  return { message: "场景在场 actor 已更新。" };
}

export type { ScenePresenceInput } from "./actor-schema.ts";

export interface ScenePresenceResult {
  message: string;
}

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
    case "ensure-public-npc":
      return ensurePublicNpc(draft, input);
    case "upsert-servant":
      return upsertServant(draft, input);
    default:
      throw new Error("unreachable actor registry input kind");
  }
}

function upsertProtagonist(
  draft: State,
  input: Extract<ActorRegistryInput, { kind: "setup-protagonist" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  if (input.actor.id !== "protagonist") {
    throw new Error("setup-protagonist 只能写入 actor.id=protagonist。");
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

function ensurePublicNpc(
  draft: State,
  input: Extract<ActorRegistryInput, { kind: "ensure-public-npc" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  const actor = toSafePublicActorFromSkeleton(input.npc);
  if (draft.public.actors[actor.id] !== undefined) {
    return { message: `actor 已存在：${actor.id}。` };
  }
  draft.public.actors[actor.id] = actor;
  return { message: `public npc skeleton 已写入：${actor.id}。` };
}

function upsertServant(
  draft: State,
  input: Extract<ActorRegistryInput, { kind: "upsert-servant" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  const sv = input.servant;
  assertNonEmptyString(sv.id, "servant.id");
  assertNonEmptyString(sv.internalName, "servant.internalName");
  assertNonEmptyString(sv.publicIdentity, "servant.publicIdentity");

  const actor: PublicActorState = {
    id: sv.id,
    kind: "spirit",
    origin: "圣杯召唤",
    roles: sv.publicRoles ?? [],
    magecraft: null,
    servantForm: {
      identity: {
        className: sv.className,
        trueName: {
          status: sv.trueNameStatus,
          display: sv.trueNameDisplay,
        },
        locked: true,
      },
      condition: {
        spiritualCore: { value: sv.spiritualCore },
        mana: { value: sv.mana },
        spiritualCondition: sv.spiritualCondition,
        permanentDefects: [],
      },
      contract: {
        masterActorId: normalizeServantMasterActorId(sv),
        masterName: normalizeServantMasterName(sv),
        status: sv.contractStatus,
        manaSupply: sv.manaSupply,
      },
      parameters: {
        base: sv.parameters,
        modifiers: [],
        baseLocked: true,
      },
      skills: {
        classSkills: sv.classSkills,
        personalSkills: sv.personalSkills,
      },
      noblePhantasms: sv.noblePhantasms,
      currentOrder: sv.currentOrder,
    },
    identity: {
      publicIdentity: sv.publicIdentity,
      background: sv.publicIdentity,
      lockedFacts: [],
    },
    presentation: {
      internalName: sv.internalName,
      renderName: sv.renderName ?? sv.internalName,
      apparentAge: sv.apparentAge,
      outfit: sv.outfit,
      demeanor: sv.demeanor,
    },
    condition: { wounds: [], afflictions: [], permanentEffects: [] },
    inventory: { ordinaryItems: sv.ordinaryItems ?? [] },
    abilities: [],
    relationshipToProtagonist: sv.relationshipToProtagonist ?? {
      stance: "neutral",
      summary: "尚未建立关系。",
    },
  };

  writeActor(draft, actor);
  return { message: `从者已写入：${sv.id} (${sv.className})。` };
}

function normalizeServantMasterActorId(servant: ServantInput): ActorId | null {
  if (servant.contractStatus !== "masterless") {
    return assertNonEmptyString(servant.masterActorId, "servant.masterActorId");
  }
  if (
    servant.masterActorId === undefined ||
    servant.masterActorId === null ||
    servant.masterActorId === "none"
  ) {
    return null;
  }
  return assertNonEmptyString(servant.masterActorId, "servant.masterActorId");
}

function normalizeServantMasterName(servant: ServantInput): string | null {
  if (servant.contractStatus !== "masterless") {
    return assertNonEmptyString(servant.masterName, "servant.masterName");
  }
  if (
    servant.masterName === undefined ||
    servant.masterName === null ||
    servant.masterName === "无"
  ) {
    return null;
  }
  return assertNonEmptyString(servant.masterName, "servant.masterName");
}

export function retireActor(draft: State, input: RetireActorInput): RetireActorResult {
  const actorId = assertNonEmptyString(input.actorId, "actorId");
  assertNonEmptyString(input.reason, "reason");
  if (actorId === "protagonist") {
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

/**
 * actor 生命周期的唯一级联出口：从所有按 actorId 聚合的状态中抹除该 actor。
 * 独占表（actors / actorSecrets / impressions / agendas / knowledgeLenses）按 key 删除；
 * 关系边（两层 relationshipSignals）凡是碰到该 actor 的一端就一起删。
 * 所有退场路径必须走这里，不允许再手动逐表删除。
 */
export function removeActorEverywhere(draft: State, actorId: ActorId): void {
  delete draft.public.actors[actorId];
  delete draft.public.actorImpressions[actorId];
  delete draft.secrets.actorSecrets[actorId];
  delete draft.secrets.actorAgendas[actorId];
  delete draft.secrets.actorKnowledgeLenses[actorId];
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

function assertActorHasNoBlockingReferences(publicState: PublicGameState, actorId: ActorId): void {
  for (const [otherActorId, actor] of Object.entries(publicState.actors)) {
    if (otherActorId === actorId) continue;
    const contractedServantIds = actor.roles.flatMap((role) =>
      role.kind === "master" ? role.contractedServantIds : [],
    );
    if (contractedServantIds.includes(actorId)) {
      throw new Error(`actor ${actorId} 仍被 ${otherActorId} 的 contractedServantIds 引用。`);
    }
    if (actor.servantForm?.contract.masterActorId === actorId) {
      throw new Error(`actor ${actorId} 仍是 ${otherActorId} 的 masterActorId。`);
    }
  }
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
    roles: npc.publicRoles,
    magecraft: null,
    servantForm: null,
    identity: {
      publicIdentity: assertNonEmptyString(npc.publicIdentity, "npc.publicIdentity"),
      background: assertNonEmptyString(npc.publicIdentity, "npc.publicIdentity"),
      lockedFacts: [],
    },
    presentation: {
      internalName: assertNonEmptyString(npc.internalName, "npc.internalName"),
      renderName: assertNonEmptyString(npc.renderName ?? npc.internalName, "npc.renderName"),
      apparentAge: assertNonEmptyString(npc.apparentAge, "npc.apparentAge"),
      outfit: npc.outfit,
      demeanor: assertNonEmptyString(npc.demeanor, "npc.demeanor"),
    },
    condition: { wounds: [], afflictions: [], permanentEffects: [] },
    inventory: { ordinaryItems: npc.ordinaryItems },
    abilities: [],
    relationshipToProtagonist: npc.relationshipToProtagonist,
  };

  switch (npc.kind) {
    case "human":
      return { ...base, kind: "human" };
    case "outsider":
      return {
        ...base,
        kind: "outsider",
        sourceProfile: "玩家可见信息未确认",
        fateTranslation: "玩家可见信息未确认",
        restrictions: [],
      };
    case "spirit":
      return { ...base, kind: "spirit", origin: "玩家可见信息未确认" };
    case "other":
      return { ...base, kind: "other", nature: "玩家可见信息未确认" };
    default:
      throw new Error("unreachable public npc kind");
  }
}

function toSafePublicActorFromSkeleton(npc: PublicNpcSkeletonInput): PublicActorState {
  return toSafePublicActor({
    id: npc.actorId,
    kind: npc.npcKind ?? "human",
    internalName: npc.internalName,
    publicIdentity: npc.publicIdentity,
    apparentAge: npc.apparentAge ?? "玩家可见年龄未确认",
    outfit: npc.outfit ?? {
      label: "玩家可见外观未确认",
      details: "玩家可见外观未确认",
    },
    demeanor: npc.demeanor ?? "玩家可见举止未确认",
    publicRoles: npc.publicRoles ?? [],
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
