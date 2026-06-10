import type {
  ActorId,
  ActorKind,
  ActorRole,
  FateParams,
  NoblePhantasm,
  OutfitState,
  PublicActorState,
  PublicGameState,
  RelationshipState,
  ServantClass,
  ServantSkill,
} from "./state";

import type { ScenePresenceInput } from "./actor-schema";

import { assertNonEmptyString, updateState } from "./state";

export interface UpsertActorInput {
  actor: PublicActorState;
  reason: string;
}

export interface PublicNpcInput {
  id: ActorId;
  kind: "human" | "outsider" | "spirit" | "other";
  displayName: string;
  publicIdentity: string;
  apparentAge: string;
  outfit: OutfitState;
  demeanor: string;
  publicRoles: ActorRole[];
  relationshipToProtagonist: RelationshipState;
  ordinaryItems: string[];
}

export interface PublicNpcSkeletonInput {
  actorId: ActorId;
  npcKind?: ActorKind;
  displayName: string;
  publicIdentity: string;
  apparentAge?: string;
  outfit?: OutfitState;
  demeanor?: string;
  publicRoles?: ActorRole[];
  relationshipToProtagonist?: RelationshipState;
  ordinaryItems?: string[];
}

export interface ServantInput {
  id: ActorId;
  displayName: string;
  publicIdentity: string;
  apparentAge: string;
  outfit: OutfitState;
  demeanor: string;
  className: ServantClass;
  trueNameDisplay: string;
  trueNameStatus: "hidden" | "suspected" | "revealed";
  parameters: FateParams;
  classSkills: ServantSkill[];
  personalSkills: ServantSkill[];
  noblePhantasms: NoblePhantasm[];
  spiritualCore: number;
  mana: number;
  spiritualCondition: string;
  masterActorId: ActorId | null;
  masterName: string | null;
  contractStatus: "stable" | "weak" | "cut" | "masterless";
  manaSupply: "sufficient" | "strained" | "starved";
  currentOrder: string;
  publicRoles?: ActorRole[];
  relationshipToProtagonist?: RelationshipState;
  ordinaryItems?: string[];
}

export type ActorRegistryInput =
  | {
      kind: "setup-protagonist";
      actor: PublicActorState;
      reason: string;
    }
  | {
      kind: "upsert-public-npc";
      npc: PublicNpcInput;
      reason: string;
    }
  | {
      kind: "ensure-public-npc";
      npc: PublicNpcSkeletonInput;
      reason: string;
    }
  | {
      kind: "upsert-servant";
      servant: ServantInput;
      reason: string;
    };

export interface UpsertActorResult {
  message: string;
}

export function setScenePresence(input: ScenePresenceInput): ScenePresenceResult {
  assertNonEmptyString(input.reason, "reason");
  updateState((draft) => {
    assertKnownActors(draft.public.actors, input.presentActorIds, "presentActorIds");
    assertKnownActors(draft.public.actors, input.allyActorIds, "allyActorIds");
    draft.public.scene.presentActorIds = uniqueActorIds(input.presentActorIds);
    draft.public.allyActorIds = uniqueActorIds(input.allyActorIds);
  });
  return { message: "场景在场 actor 已更新。" };
}

export type { ScenePresenceInput } from "./actor-schema";

export interface ScenePresenceResult {
  message: string;
}

export interface RetireActorInput {
  actorId: ActorId;
  reason: string;
}

export interface RetireActorResult {
  message: string;
}

export function upsertActor(input: ActorRegistryInput): UpsertActorResult {
  switch (input.kind) {
    case "setup-protagonist":
      return upsertProtagonist(input);
    case "upsert-public-npc":
      return upsertPublicNpc(input);
    case "ensure-public-npc":
      return ensurePublicNpc(input);
    case "upsert-servant":
      return upsertServant(input);
    default:
      throw new Error("unreachable actor registry input kind");
  }
}

function upsertProtagonist(
  input: Extract<ActorRegistryInput, { kind: "setup-protagonist" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  if (input.actor.id !== "protagonist") {
    throw new Error("setup-protagonist 只能写入 actor.id=protagonist。");
  }
  writeActor(input.actor);
  return { message: `actor 已写入：${input.actor.id}。` };
}

function upsertPublicNpc(
  input: Extract<ActorRegistryInput, { kind: "upsert-public-npc" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  const actor = toSafePublicActor(input.npc);
  writeActor(actor);
  return { message: `public npc 已写入：${actor.id}。` };
}

function ensurePublicNpc(
  input: Extract<ActorRegistryInput, { kind: "ensure-public-npc" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  const actor = toSafePublicActorFromSkeleton(input.npc);
  let created = false;
  updateState((draft) => {
    if (draft.public.actors[actor.id] !== undefined) {
      return;
    }
    draft.public.actors[actor.id] = actor;
    created = true;
  });
  return {
    message: created ? `public npc skeleton 已写入：${actor.id}。` : `actor 已存在：${actor.id}。`,
  };
}

function upsertServant(
  input: Extract<ActorRegistryInput, { kind: "upsert-servant" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  const sv = input.servant;
  assertNonEmptyString(sv.id, "servant.id");
  assertNonEmptyString(sv.displayName, "servant.displayName");
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
      displayName: sv.displayName,
      apparentAge: sv.apparentAge,
      outfit: sv.outfit,
      demeanor: sv.demeanor,
    },
    condition: { wounds: [], afflictions: [], permanentEffects: [] },
    inventory: { ordinaryItems: sv.ordinaryItems ?? [], heldTrackedItemIds: [] },
    abilities: [],
    relationshipToProtagonist: sv.relationshipToProtagonist ?? {
      stance: "neutral",
      summary: "尚未建立关系。",
    },
  };

  writeActor(actor);
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

export function retireActor(input: RetireActorInput): RetireActorResult {
  const actorId = assertNonEmptyString(input.actorId, "actorId");
  assertNonEmptyString(input.reason, "reason");
  if (actorId === "protagonist") {
    throw new Error("不能 retire protagonist。");
  }
  updateState((draft) => {
    const actor = draft.public.actors[actorId];
    if (actor === undefined) {
      throw new Error(`actor 不存在，无法 retire: ${actorId}。`);
    }
    assertActorHasNoBlockingReferences(draft.public, actorId);
    delete draft.public.actors[actorId];
    delete draft.secrets.actorSecrets[actorId];
    draft.public.scene.presentActorIds = draft.public.scene.presentActorIds.filter(
      (presentActorId) => presentActorId !== actorId,
    );
    draft.public.allyActorIds = draft.public.allyActorIds.filter(
      (allyActorId) => allyActorId !== actorId,
    );
  });
  return { message: `actor 已退场并从当前 registry 移除：${actorId}。` };
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
}

function writeActor(actor: PublicActorState): void {
  updateState((draft) => {
    draft.public.actors[actor.id] = actor;
  });
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
      displayName: assertNonEmptyString(npc.displayName, "npc.displayName"),
      apparentAge: assertNonEmptyString(npc.apparentAge, "npc.apparentAge"),
      outfit: npc.outfit,
      demeanor: assertNonEmptyString(npc.demeanor, "npc.demeanor"),
    },
    condition: { wounds: [], afflictions: [], permanentEffects: [] },
    inventory: { ordinaryItems: npc.ordinaryItems, heldTrackedItemIds: [] },
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
    displayName: npc.displayName,
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
