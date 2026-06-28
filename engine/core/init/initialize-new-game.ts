import type { MemoryClaim } from "../knowledge/memory.ts";
import type {
  ActorId,
  CurrencyCode,
  LocationState,
  OpeningMode,
  OutfitState,
  PathwayId,
  PromotionSystem,
  PublicActorState,
  RuleSetId,
  SequenceRank,
  SituationKind,
  State,
  TagEntry,
  TimelineId,
  TimeZoneId,
} from "../state/state.ts";
import type { TypeBoxValidator } from "../utils/typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { getCampaignPreset } from "../../../data/campaign-presets.ts";
import { OUTFIT_STATE_SCHEMA } from "../actor/actor-schema.ts";
import { setScenePresence, upsertActor } from "../actor/actor.ts";
import { recordMemory } from "../knowledge/memory.ts";
import { normalizeIsoInstant } from "../state/date-time.ts";
import {
  PATHWAY_ID_SCHEMA,
  PROMOTION_SYSTEM_SCHEMA,
  SEQUENCE_RANK_SCHEMA,
  stringEnumSchema,
} from "../state/state-enum-schemas.ts";
import { createId } from "../utils/ids.ts";
import {
  assertNonEmptyString,
  parseTaggedTypeBoxUnion,
  trimStringsDeep,
} from "../utils/typebox-validation.ts";
import { createInitialState, PROTAGONIST_ACTOR_ID } from "./initial-state.ts";

// ---------------------------------------------------------------------------
// TS 类型
// ---------------------------------------------------------------------------

export type NewGameInitializationInput = HumanNewGameInput | BeyonderNewGameInput;

export interface NewGameScenarioInput {
  presetId: string;
  title?: string;
  timeline?: TimelineId;
  openingMode?: OpeningMode;
  premise?: string;
  activeRuleSetIds?: RuleSetId[];
  timezone?: TimeZoneId;
  startedAt?: string;
  currentAt?: string;
  location?: LocationState;
  situation?: SituationKind;
  currency?: CurrencyCode;
  startingFunds?: number;
  purseLabel?: string;
  reason?: string;
}

export interface HumanNewGameInput {
  kind: "human-protagonist";
  scenario: NewGameScenarioInput;
  protagonist: HumanProtagonistOpeningInput;
  presence?: NewGamePresenceInput;
  knownFacts?: NewGameKnownFactInput[];
  reason: string;
}

export interface BeyonderNewGameInput {
  kind: "beyonder-protagonist";
  scenario: NewGameScenarioInput;
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
  roles?: string[];
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
  roles?: string[];
  abilities?: string[];
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

const NEW_GAME_SCENARIO_INPUT_SCHEMA = Type.Object({
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

const MEMORY_SCOPE_SCHEMA_FOR_INIT = stringEnumSchema(["protagonist", "npc", "faction", "world"]);

const NEW_GAME_KNOWN_FACT_SCHEMA = Type.Object({
  scope: MEMORY_SCOPE_SCHEMA_FOR_INIT,
  subject: Type.Optional(Type.String({ minLength: 1 })),
  text: Type.String({ minLength: 1 }),
});
const HUMAN_PROTAGONIST_OPENING_SCHEMA = Type.Object({
  canonicalName: Type.String({ minLength: 1 }),
  renderName: Type.Optional(Type.String({ minLength: 1 })),
  publicIdentity: Type.String({ minLength: 1 }),
  background: Type.String({ minLength: 1 }),
  apparentAge: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  demeanor: Type.String({ minLength: 1 }),
  roles: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
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
  roles: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  abilities: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});

export const NEW_GAME_KINDS = ["human-protagonist", "beyonder-protagonist"] as const;
const NEW_GAME_KIND_SCHEMA = stringEnumSchema(NEW_GAME_KINDS);

const HUMAN_NEW_GAME_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("human-protagonist"),
  scenario: NEW_GAME_SCENARIO_INPUT_SCHEMA,
  protagonist: HUMAN_PROTAGONIST_OPENING_SCHEMA,
  presence: Type.Optional(NEW_GAME_PRESENCE_INPUT_SCHEMA),
  reason: Type.String({ minLength: 1 }),
  knownFacts: Type.Optional(Type.Array(NEW_GAME_KNOWN_FACT_SCHEMA)),
});

const BEYONDER_NEW_GAME_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("beyonder-protagonist"),
  scenario: NEW_GAME_SCENARIO_INPUT_SCHEMA,
  protagonist: BEYONDER_PROTAGONIST_OPENING_SCHEMA,
  presence: Type.Optional(NEW_GAME_PRESENCE_INPUT_SCHEMA),
  reason: Type.String({ minLength: 1 }),
  knownFacts: Type.Optional(Type.Array(NEW_GAME_KNOWN_FACT_SCHEMA)),
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
function applyScenario(draft: State, input: NewGameScenarioInput): void {
  const reason = assertNonEmptyString(input.reason ?? "", "reason");
  const preset = getCampaignPreset(input.presetId);
  const title: string = input.title ?? preset.title;
  const timeline: TimelineId = input.timeline ?? preset.timeline;
  const openingMode: OpeningMode = input.openingMode ?? preset.openingMode;
  const premise: string = input.premise ?? preset.premise;
  const activeRuleSetIds: RuleSetId[] = input.activeRuleSetIds ?? preset.activeRuleSetIds;
  const timezone: TimeZoneId = input.timezone ?? preset.timezone;
  const startedAt = normalizeIsoInstant(input.startedAt ?? preset.startedAt, "startedAt");
  const currentAt = normalizeIsoInstant(
    input.currentAt ?? input.startedAt ?? preset.currentAt,
    "currentAt",
  );
  const location: LocationState = input.location ?? preset.location;
  const situation: SituationKind = input.situation ?? preset.situation;
  const currency: CurrencyCode = input.currency ?? preset.economy.currency;
  const startingFunds: number = input.startingFunds ?? preset.economy.startingFunds;
  const purseLabel: string = input.purseLabel ?? preset.economy.purseLabel;

  draft.public.scenario = { title, timeline, openingMode, premise, activeRuleSetIds };
  draft.public.clock.startedAt = startedAt;
  draft.public.clock.currentAt = currentAt;
  draft.public.clock.timezone = timezone;
  draft.public.clock.lastLongRestAt = null;
  draft.public.scene.location = location;
  draft.public.scene.situation = situation;
  draft.public.scene.lastResolvedAt = currentAt;
  draft.public.economy.currency = currency;
  draft.public.economy.accessibleFunds = [
    {
      id: "purse-protagonist-cash",
      ownerActorId: draft.public.protagonistActorId,
      label: purseLabel,
      amount: startingFunds,
      access: "held",
    },
  ];
  draft.public.memory.pinnedFacts = [
    ...draft.public.memory.pinnedFacts.filter((fact) => fact.id !== "fact-campaign-configured"),
    {
      id: "fact-campaign-configured",
      scope: "world",
      subject: "scenario",
      text: `Scenario 已配置：${timeline}；timeline=${timezone}。${reason}`,
      since: currentAt,
      sourceEventId: null,
    },
  ];
  draft.public.memory.eventLog.push({
    id: createId(draft, "event"),
    time: currentAt,
    title: "Scenario 配置",
    summary: reason,
    consequences: [`当前时间线: ${timeline}`, `本地时区: ${timezone}`],
  });
}

export function initializeNewGame(
  draft: State,
  input: NewGameInitializationInput,
): NewGameInitializationResult {
  const steps: string[] = [];
  Object.assign(draft, createInitialState());
  steps.push("reset-state");

  applyScenario(draft, { ...input.scenario, reason: input.scenario.reason ?? input.reason });
  steps.push("configure-scenario");

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
    sequence: null,
    identity: {
      publicIdentity: input.publicIdentity,
      background: input.background,
      lockedFacts: [],
      roles: input.roles ?? [],
    },
    presentation: {
      canonicalName: input.canonicalName,
      renderName: input.renderName ?? input.canonicalName,
      apparentAge: input.apparentAge,
      outfit: input.outfit,
      demeanor: input.demeanor,
    },
    condition: { afflictions: [] },
    inventory: { items: input.ordinaryItems ?? [] },
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
    sequence: {
      currentSequence: input.currentSequence,
      rank: input.rank,
      pathway: input.pathway,
      promotionSystem: input.promotionSystem ?? "potion",
      actingCues: [],
      tags: [] as TagEntry[],
    },
    identity: {
      publicIdentity: input.publicIdentity,
      background: input.background,
      lockedFacts: [],
      roles: input.roles ?? [],
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
  if (state.public.scenario.title.trim().length === 0) {
    throw new Error("新游戏初始化失败：scenario 未配置。");
  }
  if (input.kind === "beyonder-protagonist") {
    if (protagonist.sequence === null) {
      throw new Error("新游戏初始化失败：非凡者 protagonist 缺少 sequence。");
    }
  }
}
