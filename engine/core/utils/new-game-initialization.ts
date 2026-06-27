import type { ConfigureCampaignInput } from "../campaign/campaign.ts";
import type { MemoryClaim } from "../memory/memory.ts";
import type {
  ActorId,
  ActorRole,
  CharacterStats,
  OutfitState,
  PathwayId,
  PromotionSystem,
  PublicActorState,
  SequenceRank,
  State,
  StatsValues,
  TagEntry,
} from "../state/state.ts";

import { sequenceBaseline, getSequenceWeights, sequenceTagsMapping } from "../../config/index.ts";
import { setScenePresence, upsertActor } from "../actor/actor.ts";
import { configureCampaign } from "../campaign/campaign.ts";
import { sequenceRankToIndex } from "../combat/sequence-utils.ts";
import { recordMemory } from "../memory/memory.ts";
import { createInitialState, PROTAGONIST_ACTOR_ID } from "../state/state-store.ts";

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
    stats: null,
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
    equipment: { weapon: null, clothing: null, accessory: null, sealedArtifact: null },
    inventory: { ordinaryItems: input.ordinaryItems ?? [], storedEquipment: [] },
    abilities: (input.abilities ?? []).map((summary, index) => ({
      id: `ability-protagonist-${index + 1}`,
      label: summary,
      summary,
    })),
    relationshipToProtagonist: { stance: "self", summary: "玩家本人。" },
  };
}

function buildBeyonderProtagonist(input: BeyonderProtagonistOpeningInput): PublicActorState {
  const stats = computeBaseStats(input.currentSequence, input.rank);
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
      tags: resolveSequenceTags(input.currentSequence),
    },
    stats,
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
    equipment: { weapon: null, clothing: null, accessory: null, sealedArtifact: null },
    inventory: { ordinaryItems: input.ordinaryItems ?? [], storedEquipment: [] },
    abilities: (input.abilities ?? []).map((summary, index) => ({
      id: `ability-protagonist-${index + 1}`,
      label: summary,
      summary,
    })),
    relationshipToProtagonist: { stance: "self", summary: "玩家本人。" },
  };
}

/**
 * 根据序列名和序列等级计算六维基础值（base）。
 * 公式：base[attr] = floor(序列基准[等级] × 序列权重[attr])
 * base = max = current（新创建角色无效果影响）。
 */
function computeBaseStats(sequenceName: string, rank: SequenceRank): CharacterStats {
  const rankIndex = sequenceRankToIndex(rank);
  const totalPoints = sequenceBaseline[String(rankIndex)] ?? sequenceBaseline["普通"] ?? 200;
  const weights = getSequenceWeights(sequenceName);

  let vitality = 0,
    agility = 0,
    spirituality = 0,
    sanity = 0,
    humanity = 0,
    luck = 0;
  if (weights !== null) {
    vitality = Math.floor(totalPoints * weights[0]);
    agility = Math.floor(totalPoints * weights[1]);
    spirituality = Math.floor(totalPoints * weights[2]);
    sanity = Math.floor(totalPoints * weights[3]);
    humanity = Math.floor(totalPoints * weights[4]);
    luck = Math.floor(totalPoints * weights[5]);
  }

  const values: StatsValues = { vitality, agility, spirituality, sanity, humanity, luck };
  return { base: values, max: values, current: values };
}

/**
 * 从序列名解析标签列表。
 * 从 sequenceTagsMapping 读取序列的标签配置，初始化 stacks=1。
 */
function resolveSequenceTags(sequenceName: string): TagEntry[] {
  const def = sequenceTagsMapping[sequenceName];
  if (!def) return [];
  return def.tags.map((name) => ({ name, duration: def.duration, stacks: 1 }));
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
