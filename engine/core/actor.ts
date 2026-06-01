import type {
  ActorId,
  ActorRole,
  FateParams,
  NoblePhantasm,
  OutfitState,
  PublicActorState,
  RelationshipState,
  ServantClass,
  ServantSkill,
} from "./state";

import { assertNonEmptyString, updateState } from "./state";

export interface UpsertActorInput {
  actor: PublicActorState;
  present: boolean;
  ally: boolean;
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
      present: boolean;
      ally: boolean;
      reason: string;
    }
  | {
      kind: "upsert-public-npc";
      npc: PublicNpcInput;
      present: boolean;
      ally: boolean;
      reason: string;
    }
  | {
      kind: "upsert-servant";
      servant: ServantInput;
      present: boolean;
      ally: boolean;
      reason: string;
    };

export interface UpsertActorResult {
  message: string;
}

export function upsertActor(input: ActorRegistryInput): UpsertActorResult {
  switch (input.kind) {
    case "setup-protagonist":
      return upsertProtagonist(input);
    case "upsert-public-npc":
      return upsertPublicNpc(input);
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
  writeActor(input.actor, input.present, input.ally);
  return { message: `actor 已写入：${input.actor.id}。` };
}

function upsertPublicNpc(
  input: Extract<ActorRegistryInput, { kind: "upsert-public-npc" }>,
): UpsertActorResult {
  assertNonEmptyString(input.reason, "reason");
  const actor = toSafePublicActor(input.npc);
  writeActor(actor, input.present, input.ally);
  return { message: `public npc 已写入：${actor.id}。` };
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
        masterActorId: sv.masterActorId,
        masterName: sv.masterName,
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

  writeActor(actor, input.present, input.ally);
  return { message: `从者已写入：${sv.id} (${sv.className})。` };
}

function writeActor(actor: PublicActorState, present: boolean, ally: boolean): void {
  updateState((draft) => {
    draft.public.actors[actor.id] = actor;
    if (present) {
      draft.public.scene.presentActorIds = appendUniqueActorId(
        draft.public.scene.presentActorIds,
        actor.id,
      );
    }
    if (ally) {
      draft.public.allyActorIds = appendUniqueActorId(draft.public.allyActorIds, actor.id);
    }
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

function appendUniqueActorId(ids: ActorId[], actorId: ActorId): ActorId[] {
  return ids.includes(actorId) ? ids : [...ids, actorId];
}
