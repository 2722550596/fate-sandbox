import type { ConfigureCampaignInput } from "./campaign.ts";
import type { MemoryClaim } from "./memory.ts";
import type {
  ActorId,
  ActorRole,
  OutfitState,
  PathwayId,
  PromotionSystem,
  PublicActorState,
  SequenceRank,
  State,
} from "./state.ts";

import { setScenePresence, upsertActor } from "./actor.ts";
import { configureCampaign } from "./campaign.ts";
import { recordMemory } from "./memory.ts";
import { createInitialState, PROTAGONIST_ACTOR_ID } from "./state-store.ts";

export type NewGameInitializationInput = HumanNewGameInput | BeyonderNewGameInput;

export interface NewGameCampaignInput extends Omit<ConfigureCampaignInput, "reason"> {
  reason?: string;
}

export interface HumanNewGameInput {
  kind: "human-protagonist";
  campaign: NewGameCampaignInput;
  protagonist: HumanProtagonistOpeningInput;
  presence?: NewGamePresenceInput;
  knownFacts?: NewGameKnownFactInput[];
  reason: string;
}

export interface BeyonderNewGameInput {
  kind: "beyonder-protagonist";
  campaign: NewGameCampaignInput;
  protagonist: BeyonderProtagonistOpeningInput;
  presence?: NewGamePresenceInput;
  knownFacts?: NewGameKnownFactInput[];
  reason: string;
}

export interface HumanProtagonistOpeningInput {
  internalName: string;
  renderName?: string;
  publicIdentity: string;
  background: string;
  apparentAge: string;
  outfit: OutfitState;
  demeanor: string;
  roles?: ActorRole[];
  abilities?: string[];
  ordinaryItems?: string[];
}

export interface BeyonderProtagonistOpeningInput {
  internalName: string;
  renderName?: string;
  publicIdentity: string;
  background: string;
  apparentAge: string;
  outfit: OutfitState;
  demeanor: string;
  currentSequence: string;
  rank: SequenceRank;
  pathway: PathwayId;
  promotionSystem?: PromotionSystem;
  divinity?: number;
  digestionProgress?: number;
  lossOfControlProgress?: number;
  roles?: ActorRole[];
  abilities?: string[];
  ordinaryItems?: string[];
}

export interface NewGamePresenceInput {
  presentActorIds: ActorId[];
  allyActorIds?: ActorId[];
}

export interface NewGameKnownFactInput {
  scope: "protagonist" | "npc" | "faction" | "world";
  subject?: string;
  text: string;
  claims?: MemoryClaim[];
}

export interface NewGameInitializationResult {
  message: string;
  steps: string[];
}

export function initializeNewGame(
  draft: State,
  input: NewGameInitializationInput,
): NewGameInitializationResult {
  const steps: string[] = [];
  Object.assign(draft, createInitialState());
  steps.push("reset-state");

  configureCampaign(draft, { ...input.campaign, reason: input.campaign.reason ?? input.reason });
  steps.push("configure-campaign");

  if (input.kind === "human-protagonist") {
    upsertActor(draft, {
      kind: "setup-protagonist",
      actor: buildHumanProtagonist(input.protagonist),
      reason: input.reason,
    });
    steps.push("setup-human-protagonist");
  } else {
    upsertActor(draft, {
      kind: "setup-protagonist",
      actor: buildBeyonderProtagonist(input.protagonist),
      reason: input.reason,
    });
    steps.push("setup-beyonder-protagonist");
  }

  if (input.presence !== undefined) {
    setScenePresence(draft, {
      presentActorIds: input.presence.presentActorIds,
      allyActorIds: input.presence.allyActorIds ?? [],
      reason: input.reason,
    });
    steps.push("set-scene-presence");
  }

  for (const fact of input.knownFacts ?? []) {
    recordMemory(draft, {
      kind: "pin-fact",
      scope: fact.scope,
      subject: fact.subject ?? PROTAGONIST_ACTOR_ID,
      text: fact.text,
      claims: fact.claims ?? [{ kind: "mundane", statement: fact.text, certainty: "confirmed" }],
      sourceEventId: null,
    });
    steps.push("record-known-fact");
  }

  assertNewGameInitialized(draft, input);
  return { message: "新游戏 state 已初始化。", steps };
}

function buildHumanProtagonist(input: HumanProtagonistOpeningInput): PublicActorState {
  return {
    id: PROTAGONIST_ACTOR_ID,
    kind: "human",
    roles: input.roles ?? [],
    sequence: null,
    identity: {
      publicIdentity: input.publicIdentity,
      background: input.background,
      lockedFacts: [],
    },
    presentation: {
      internalName: input.internalName,
      renderName: input.renderName ?? input.internalName,
      apparentAge: input.apparentAge,
      outfit: input.outfit,
      demeanor: input.demeanor,
    },
    condition: { statusEffects: [] },
    inventory: { ordinaryItems: input.ordinaryItems ?? [] },
    abilities: (input.abilities ?? []).map((summary, index) => ({
      id: `ability-protagonist-${index + 1}`,
      label: summary,
      summary,
    })),
    relationshipToProtagonist: { stance: "self", summary: "玩家本人。" },
  };
}

function buildBeyonderProtagonist(input: BeyonderProtagonistOpeningInput): PublicActorState {
  return {
    id: PROTAGONIST_ACTOR_ID,
    kind: "beyonder",
    roles: input.roles ?? [],
    sequence: {
      currentSequence: input.currentSequence,
      rank: input.rank,
      pathway: input.pathway,
      promotionSystem: input.promotionSystem ?? "potion",
      divinity: input.divinity ?? 1,
      digestionProgress: input.digestionProgress ?? 0,
      lossOfControlProgress: input.lossOfControlProgress ?? 0,
    },
    identity: {
      publicIdentity: input.publicIdentity,
      background: input.background,
      lockedFacts: [],
    },
    presentation: {
      internalName: input.internalName,
      renderName: input.renderName ?? input.internalName,
      apparentAge: input.apparentAge,
      outfit: input.outfit,
      demeanor: input.demeanor,
    },
    condition: { statusEffects: [] },
    inventory: { ordinaryItems: input.ordinaryItems ?? [] },
    abilities: (input.abilities ?? []).map((summary, index) => ({
      id: `ability-protagonist-${index + 1}`,
      label: summary,
      summary,
    })),
    relationshipToProtagonist: { stance: "self", summary: "玩家本人。" },
  };
}

function assertNewGameInitialized(state: State, input: NewGameInitializationInput): void {
  const protagonist = state.public.actors[PROTAGONIST_ACTOR_ID];
  if (protagonist === undefined) {
    throw new Error("新游戏初始化失败：protagonist actor 不存在。");
  }
  if (state.public.protagonistActorId !== PROTAGONIST_ACTOR_ID) {
    throw new Error("新游戏初始化失败：protagonistActorId 必须是 protagonist。");
  }
  if (state.public.campaign.title.trim().length === 0) {
    throw new Error("新游戏初始化失败：campaign 未配置。");
  }
  if (input.kind === "beyonder-protagonist") {
    if (protagonist.sequence === null) {
      throw new Error("新游戏初始化失败：非凡者 protagonist 缺少 sequence。");
    }
  }
}
