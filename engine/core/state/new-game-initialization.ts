import type { ConfigureCampaignInput } from "../campaign/campaign.ts";
import type { MemoryClaim } from "../knowledge/memory.ts";
import type { TypeBoxValidator } from "../utils/typebox-validation.ts";
import type {
  ActorId,
  ActorRole,
  OutfitState,
  PathwayId,
  PromotionSystem,
  PublicActorState,
  SequenceRank,
  State,
  TagEntry,
} from "../state/state.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { OUTFIT_STATE_SCHEMA } from "../actor/actor-schema.ts";
import { setScenePresence, upsertActor } from "../actor/actor.ts";
import { configureCampaign } from "../campaign/campaign.ts";
import { recordMemory } from "../knowledge/memory.ts";
import { createInitialState, PROTAGONIST_ACTOR_ID } from "./initial-state.ts";
import {
  PATHWAY_ID_SCHEMA,
  PROMOTION_SYSTEM_SCHEMA,
  SEQUENCE_RANK_SCHEMA,
  stringEnumSchema,
} from "../state/state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "../utils/typebox-validation.ts";

// ---------------------------------------------------------------------------
// TS 类型
// ---------------------------------------------------------------------------

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
  canonicalName: string;
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
  canonicalName: string;
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

// ---------------------------------------------------------------------------
// initialize_new_game 工具边界 schema
// ---------------------------------------------------------------------------

const NEW_GAME_CAMPAIGN_INPUT_SCHEMA = Type.Object({
  presetId: Type.String({ minLength: 1 }),
  title: Type.Optional(Type.String({ minLength: 1 })),
  premise: Type.Optional(Type.String({ minLength: 1 })),
  startedAt: Type.Optional(Type.String({ minLength: 1 })),
  currentAt: Type.Optional(Type.String({ minLength: 1 })),
  reason: Type.Optional(Type.String({ minLength: 1 })),
});

const NEW_GAME_PRESENCE_INPUT_SCHEMA = Type.Object({
  presentActorIds: Type.Array(Type.String({ minLength: 1 })),
  allyActorIds: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});

const HUMAN_PROTAGONIST_OPENING_SCHEMA = Type.Object({
  canonicalName: Type.String({ minLength: 1 }),
  renderName: Type.Optional(Type.String({ minLength: 1 })),
  publicIdentity: Type.String({ minLength: 1 }),
  background: Type.String({ minLength: 1 }),
  apparentAge: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  demeanor: Type.String({ minLength: 1 }),
  abilities: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  ordinaryItems: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});

const BEYONDER_PROTAGONIST_OPENING_SCHEMA = Type.Object({
  canonicalName: Type.String({ minLength: 1 }),
  renderName: Type.Optional(Type.String({ minLength: 1 })),
  publicIdentity: Type.String({ minLength: 1 }),
  background: Type.String({ minLength: 1 }),
  apparentAge: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  demeanor: Type.String({ minLength: 1 }),
  currentSequence: Type.String({ minLength: 1 }),
  rank: SEQUENCE_RANK_SCHEMA,
  pathway: PATHWAY_ID_SCHEMA,
  promotionSystem: Type.Optional(PROMOTION_SYSTEM_SCHEMA),
  divinity: Type.Optional(Type.Number({ minimum: 0 })),
  digestionProgress: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  lossOfControlProgress: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  abilities: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  ordinaryItems: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});

export const NEW_GAME_KINDS = ["human-protagonist", "beyonder-protagonist"] as const;
const NEW_GAME_KIND_SCHEMA = stringEnumSchema(NEW_GAME_KINDS);

const HUMAN_NEW_GAME_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("human-protagonist"),
  campaign: NEW_GAME_CAMPAIGN_INPUT_SCHEMA,
  protagonist: HUMAN_PROTAGONIST_OPENING_SCHEMA,
  presence: Type.Optional(NEW_GAME_PRESENCE_INPUT_SCHEMA),
  reason: Type.String({ minLength: 1 }),
});

const BEYONDER_NEW_GAME_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("beyonder-protagonist"),
  campaign: NEW_GAME_CAMPAIGN_INPUT_SCHEMA,
  protagonist: BEYONDER_PROTAGONIST_OPENING_SCHEMA,
  presence: Type.Optional(NEW_GAME_PRESENCE_INPUT_SCHEMA),
  reason: Type.String({ minLength: 1 }),
});

const NEW_GAME_KIND_VALIDATOR = Compile(NEW_GAME_KIND_SCHEMA);
const HUMAN_NEW_GAME_INPUT_VALIDATOR = Compile(HUMAN_NEW_GAME_INPUT_SCHEMA);
const BEYONDER_NEW_GAME_INPUT_VALIDATOR = Compile(BEYONDER_NEW_GAME_INPUT_SCHEMA);

const NEW_GAME_VARIANT_VALIDATORS = {
  "human-protagonist": HUMAN_NEW_GAME_INPUT_VALIDATOR,
  "beyonder-protagonist": BEYONDER_NEW_GAME_INPUT_VALIDATOR,
} satisfies Record<
  NewGameInitializationInput["kind"],
  TypeBoxValidator<NewGameInitializationInput>
>;

export function parseNewGameInitializationInput(
  value: unknown,
  fieldName: string,
): NewGameInitializationInput {
  return parseTaggedTypeBoxUnion<NewGameInitializationInput["kind"], NewGameInitializationInput>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    NEW_GAME_KIND_VALIDATOR,
    NEW_GAME_VARIANT_VALIDATORS,
  );
}

// ---------------------------------------------------------------------------
// 初始化引擎
// ---------------------------------------------------------------------------

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
      canonicalName: input.canonicalName,
      renderName: input.renderName ?? input.canonicalName,
      apparentAge: input.apparentAge,
      outfit: input.outfit,
      demeanor: input.demeanor,
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
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
      tags: [] as TagEntry[],
    },
    identity: {
      publicIdentity: input.publicIdentity,
      background: input.background,
      lockedFacts: [],
    },
    presentation: {
      canonicalName: input.canonicalName,
      renderName: input.renderName ?? input.canonicalName,
      apparentAge: input.apparentAge,
      outfit: input.outfit,
      demeanor: input.demeanor,
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
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