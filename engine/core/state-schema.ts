import type { Static, TSchema } from "typebox";

import type { State } from "./state.ts";
import type { TypeBoxValidator } from "./typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  ACTOR_ROLE_SCHEMA,
  FATE_PARAMS_SCHEMA,
  FATE_RANK_OR_NONE_SCHEMA,
  NOBLE_PHANTASM_SCHEMA,
  OUTFIT_STATE_SCHEMA,
  RELATIONSHIP_STATE_SCHEMA,
  SERVANT_SKILL_SCHEMA,
} from "./actor-schema.ts";
import { normalizeIsoInstant } from "./date-time.ts";
import { STORY_WINDOW_STATE_SCHEMA } from "./scene-schema.ts";
import {
  CIRCUIT_STATUS_SCHEMA,
  CONTRACT_STATUS_SCHEMA,
  CURRENCY_CODE_SCHEMA,
  FATE_PARAM_KEY_SCHEMA,
  MANA_SUPPLY_SCHEMA,
  MEMORY_SCOPE_SCHEMA,
  OFFSCREEN_EVENT_SOURCE_SCHEMA,
  OFFSCREEN_EVENT_VISIBILITY_SCHEMA,
  OPENING_MODE_SCHEMA,
  PURSE_ACCESS_SCHEMA,
  REVEAL_STATUS_SCHEMA,
  RULE_SET_ID_SCHEMA,
  SCENE_THREAT_SEVERITY_SCHEMA,
  SERVANT_CLASS_SCHEMA,
  SITUATION_KIND_SCHEMA,
  stringEnumSchema,
  TIMELINE_ID_SCHEMA,
  TIMEZONE_ID_SCHEMA,
  TRACKED_ITEM_CONDITION_SCHEMA,
  TRACKED_ITEM_KIND_SCHEMA,
  TRACKED_ITEM_VISIBILITY_SCHEMA,
  WOUND_SEVERITY_SCHEMA,
} from "./state-enum-schemas.ts";
import { LOCATION_STATE_SCHEMA } from "./turn-time-schema.ts";
import { isRecord, parseTypeBoxValue, trimStringsDeep } from "./typebox-validation.ts";

/**
 * State 反序列化边界 schema：与 state.ts 的手写接口一一对应。
 * 结构与字段约束由 TypeBox 校验；ISO 时间归一化与跨字段引用
 * （actor 引用、registry key 一致性等）由 parseStateSchema 的
 * 后置 pass 处理——schema 表达不了的不变量集中在那里。
 *
 * 与手写接口的漂移由文件底部的双向赋值检查在编译期拦截。
 */

const NON_EMPTY_STRING_SCHEMA = Type.String({ minLength: 1 });
const NON_EMPTY_STRING_ARRAY_SCHEMA = Type.Array(NON_EMPTY_STRING_SCHEMA);
/** ISO 时间字段：结构上只要求非空字符串，格式校验与归一化在后置 pass。 */
const ISO_INSTANT_SCHEMA = Type.String({ minLength: 1 });
const PERCENT_SCHEMA = Type.Integer({ minimum: 0, maximum: 100 });
const NON_NEGATIVE_INTEGER_SCHEMA = Type.Integer({ minimum: 0 });

function nullable<T extends TSchema>(schema: T) {
  return Type.Union([schema, Type.Null()]);
}

export const STATE_META_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(3),
  createdAt: ISO_INSTANT_SCHEMA,
  updatedAt: ISO_INSTANT_SCHEMA,
});

export const CAMPAIGN_STATE_SCHEMA = Type.Object({
  title: NON_EMPTY_STRING_SCHEMA,
  timeline: TIMELINE_ID_SCHEMA,
  openingMode: OPENING_MODE_SCHEMA,
  premise: NON_EMPTY_STRING_SCHEMA,
  activeRuleSetIds: Type.Array(RULE_SET_ID_SCHEMA),
});

export const CLOCK_STATE_SCHEMA = Type.Object({
  startedAt: ISO_INSTANT_SCHEMA,
  currentAt: ISO_INSTANT_SCHEMA,
  timezone: TIMEZONE_ID_SCHEMA,
  lastLongRestAt: nullable(ISO_INSTANT_SCHEMA),
});

export const SCENE_OBJECTIVE_STATUSES = ["active", "blocked", "resolved"] as const;
const SCENE_OBJECTIVE_STATUS_SCHEMA = stringEnumSchema(SCENE_OBJECTIVE_STATUSES);

export const SCENE_OBJECTIVE_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  summary: NON_EMPTY_STRING_SCHEMA,
  status: SCENE_OBJECTIVE_STATUS_SCHEMA,
});

export const SCENE_THREAT_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  summary: NON_EMPTY_STRING_SCHEMA,
  severity: SCENE_THREAT_SEVERITY_SCHEMA,
});

export const SCENE_STATE_SCHEMA = Type.Object({
  location: LOCATION_STATE_SCHEMA,
  situation: SITUATION_KIND_SCHEMA,
  storyWindow: nullable(STORY_WINDOW_STATE_SCHEMA),
  presentActorIds: NON_EMPTY_STRING_ARRAY_SCHEMA,
  objectives: Type.Array(SCENE_OBJECTIVE_SCHEMA),
  threats: Type.Array(SCENE_THREAT_SCHEMA),
  lastResolvedAt: ISO_INSTANT_SCHEMA,
});

const MAGECRAFT_CIRCUIT_STATE_SCHEMA = Type.Object({
  count: NON_EMPTY_STRING_SCHEMA,
  quality: FATE_RANK_OR_NONE_SCHEMA,
  od: PERCENT_SCHEMA,
  status: CIRCUIT_STATUS_SCHEMA,
  traits: NON_EMPTY_STRING_ARRAY_SCHEMA,
});

const MAGECRAFT_DISCIPLINE_SCHEMA = Type.Object({
  name: NON_EMPTY_STRING_SCHEMA,
  rank: FATE_RANK_OR_NONE_SCHEMA,
  notes: NON_EMPTY_STRING_SCHEMA,
});

const MAGECRAFT_CAPABILITY_SCHEMA = Type.Object({
  circuits: MAGECRAFT_CIRCUIT_STATE_SCHEMA,
  disciplines: Type.Array(MAGECRAFT_DISCIPLINE_SCHEMA),
  affiliation: nullable(NON_EMPTY_STRING_SCHEMA),
});

const IDENTITY_STATE_SCHEMA = Type.Object({
  publicIdentity: NON_EMPTY_STRING_SCHEMA,
  background: NON_EMPTY_STRING_SCHEMA,
  lockedFacts: Type.Array(
    Type.Object({ id: NON_EMPTY_STRING_SCHEMA, text: NON_EMPTY_STRING_SCHEMA }),
  ),
});

const PRESENTATION_STATE_SCHEMA = Type.Object({
  displayName: NON_EMPTY_STRING_SCHEMA,
  apparentAge: NON_EMPTY_STRING_SCHEMA,
  outfit: OUTFIT_STATE_SCHEMA,
  demeanor: NON_EMPTY_STRING_SCHEMA,
});

const WOUND_STATE_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  severity: WOUND_SEVERITY_SCHEMA,
  text: NON_EMPTY_STRING_SCHEMA,
  recoverable: Type.Boolean(),
  treatment: nullable(NON_EMPTY_STRING_SCHEMA),
});

const AFFLICTION_STATE_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  source: NON_EMPTY_STRING_SCHEMA,
  text: NON_EMPTY_STRING_SCHEMA,
  expectedDuration: nullable(NON_EMPTY_STRING_SCHEMA),
});

const PERMANENT_EFFECT_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  source: NON_EMPTY_STRING_SCHEMA,
  text: NON_EMPTY_STRING_SCHEMA,
  mechanicalEffect: NON_EMPTY_STRING_SCHEMA,
});

const CONDITION_STATE_SCHEMA = Type.Object({
  wounds: Type.Array(WOUND_STATE_SCHEMA),
  afflictions: Type.Array(AFFLICTION_STATE_SCHEMA),
  permanentEffects: Type.Array(PERMANENT_EFFECT_SCHEMA),
});

const INVENTORY_STATE_SCHEMA = Type.Object({
  ordinaryItems: NON_EMPTY_STRING_ARRAY_SCHEMA,
  heldTrackedItemIds: NON_EMPTY_STRING_ARRAY_SCHEMA,
});

const ABILITY_STATE_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  label: NON_EMPTY_STRING_SCHEMA,
  summary: NON_EMPTY_STRING_SCHEMA,
});

const TRUE_NAME_STATE_SCHEMA = Type.Object({
  status: REVEAL_STATUS_SCHEMA,
  display: NON_EMPTY_STRING_SCHEMA,
});

const SERVANT_IDENTITY_STATE_SCHEMA = Type.Object({
  className: SERVANT_CLASS_SCHEMA,
  trueName: TRUE_NAME_STATE_SCHEMA,
  locked: Type.Literal(true),
});

const RESOURCE_TRACK_SCHEMA = Type.Object({ value: PERCENT_SCHEMA });

const SERVANT_CONDITION_STATE_SCHEMA = Type.Object({
  spiritualCore: RESOURCE_TRACK_SCHEMA,
  mana: RESOURCE_TRACK_SCHEMA,
  spiritualCondition: NON_EMPTY_STRING_SCHEMA,
  permanentDefects: Type.Array(PERMANENT_EFFECT_SCHEMA),
});

const SERVANT_CONTRACT_STATE_SCHEMA = Type.Object({
  masterActorId: nullable(NON_EMPTY_STRING_SCHEMA),
  masterName: nullable(NON_EMPTY_STRING_SCHEMA),
  status: CONTRACT_STATUS_SCHEMA,
  manaSupply: MANA_SUPPLY_SCHEMA,
});

const PARAM_MODIFIER_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  source: NON_EMPTY_STRING_SCHEMA,
  affectedParams: Type.Array(FATE_PARAM_KEY_SCHEMA),
  summary: NON_EMPTY_STRING_SCHEMA,
  expiresAt: nullable(ISO_INSTANT_SCHEMA),
});

const SERVANT_PARAMETER_STATE_SCHEMA = Type.Object({
  base: FATE_PARAMS_SCHEMA,
  modifiers: Type.Array(PARAM_MODIFIER_SCHEMA),
  baseLocked: Type.Literal(true),
});

const SERVANT_SKILL_STATE_SCHEMA = Type.Object({
  classSkills: Type.Array(SERVANT_SKILL_SCHEMA),
  personalSkills: Type.Array(SERVANT_SKILL_SCHEMA),
});

export const SERVANT_CORE_STATE_SCHEMA = Type.Object({
  identity: SERVANT_IDENTITY_STATE_SCHEMA,
  condition: SERVANT_CONDITION_STATE_SCHEMA,
  contract: SERVANT_CONTRACT_STATE_SCHEMA,
  parameters: SERVANT_PARAMETER_STATE_SCHEMA,
  skills: SERVANT_SKILL_STATE_SCHEMA,
  noblePhantasms: Type.Array(NOBLE_PHANTASM_SCHEMA),
  currentOrder: NON_EMPTY_STRING_SCHEMA,
});

const ACTOR_BASE_PROPERTIES = {
  id: NON_EMPTY_STRING_SCHEMA,
  roles: Type.Array(ACTOR_ROLE_SCHEMA),
  magecraft: nullable(MAGECRAFT_CAPABILITY_SCHEMA),
  servantForm: nullable(SERVANT_CORE_STATE_SCHEMA),
  identity: IDENTITY_STATE_SCHEMA,
  presentation: PRESENTATION_STATE_SCHEMA,
  condition: CONDITION_STATE_SCHEMA,
  inventory: INVENTORY_STATE_SCHEMA,
  abilities: Type.Array(ABILITY_STATE_SCHEMA),
  relationshipToProtagonist: RELATIONSHIP_STATE_SCHEMA,
} as const;

const HUMAN_ACTOR_STATE_SCHEMA = Type.Object({
  ...ACTOR_BASE_PROPERTIES,
  kind: Type.Literal("human"),
});

const OUTSIDER_ACTOR_STATE_SCHEMA = Type.Object({
  ...ACTOR_BASE_PROPERTIES,
  kind: Type.Literal("outsider"),
  sourceProfile: NON_EMPTY_STRING_SCHEMA,
  fateTranslation: NON_EMPTY_STRING_SCHEMA,
  restrictions: NON_EMPTY_STRING_ARRAY_SCHEMA,
});

const SPIRIT_ACTOR_STATE_SCHEMA = Type.Object({
  ...ACTOR_BASE_PROPERTIES,
  kind: Type.Literal("spirit"),
  origin: NON_EMPTY_STRING_SCHEMA,
});

const OTHER_ACTOR_STATE_SCHEMA = Type.Object({
  ...ACTOR_BASE_PROPERTIES,
  kind: Type.Literal("other"),
  nature: NON_EMPTY_STRING_SCHEMA,
});

export const PUBLIC_ACTOR_STATE_SCHEMA = Type.Union([
  HUMAN_ACTOR_STATE_SCHEMA,
  OUTSIDER_ACTOR_STATE_SCHEMA,
  SPIRIT_ACTOR_STATE_SCHEMA,
  OTHER_ACTOR_STATE_SCHEMA,
]);

export const TRACKED_ITEM_STATE_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  label: NON_EMPTY_STRING_SCHEMA,
  kind: TRACKED_ITEM_KIND_SCHEMA,
  ownerActorId: nullable(NON_EMPTY_STRING_SCHEMA),
  holderActorId: nullable(NON_EMPTY_STRING_SCHEMA),
  location: nullable(LOCATION_STATE_SCHEMA),
  condition: TRACKED_ITEM_CONDITION_SCHEMA,
  visibility: TRACKED_ITEM_VISIBILITY_SCHEMA,
  notes: NON_EMPTY_STRING_ARRAY_SCHEMA,
});

const MONEY_PURSE_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  ownerActorId: NON_EMPTY_STRING_SCHEMA,
  label: NON_EMPTY_STRING_SCHEMA,
  amount: NON_NEGATIVE_INTEGER_SCHEMA,
  access: PURSE_ACCESS_SCHEMA,
});

const DEBT_STATE_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  debtorActorId: NON_EMPTY_STRING_SCHEMA,
  creditor: NON_EMPTY_STRING_SCHEMA,
  amount: NON_NEGATIVE_INTEGER_SCHEMA,
  reason: NON_EMPTY_STRING_SCHEMA,
});

const ECONOMY_STATE_SCHEMA = Type.Object({
  currency: CURRENCY_CODE_SCHEMA,
  accessibleFunds: Type.Array(MONEY_PURSE_SCHEMA),
  debts: Type.Array(DEBT_STATE_SCHEMA),
});

const MEMORY_FACT_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  scope: MEMORY_SCOPE_SCHEMA,
  subject: NON_EMPTY_STRING_SCHEMA,
  text: NON_EMPTY_STRING_SCHEMA,
  since: ISO_INSTANT_SCHEMA,
  sourceEventId: nullable(NON_EMPTY_STRING_SCHEMA),
});

const MAJOR_EVENT_MEMORY_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  time: ISO_INSTANT_SCHEMA,
  title: NON_EMPTY_STRING_SCHEMA,
  summary: NON_EMPTY_STRING_SCHEMA,
  consequences: NON_EMPTY_STRING_ARRAY_SCHEMA,
});

const DAILY_SUMMARY_MEMORY_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  startDate: ISO_INSTANT_SCHEMA,
  endDate: ISO_INSTANT_SCHEMA,
  summary: NON_EMPTY_STRING_SCHEMA,
});

const CAMPAIGN_MEMORY_SCHEMA = Type.Object({
  pinnedFacts: Type.Array(MEMORY_FACT_SCHEMA),
  eventLog: Type.Array(MAJOR_EVENT_MEMORY_SCHEMA),
  dailySummaries: Type.Array(DAILY_SUMMARY_MEMORY_SCHEMA),
});

/** turnLog 里的 time 与 parseTurnTimePolicySchema 保持同等约束（elapsedMinutes > 0）。 */
const TURN_TIME_POLICY_STATE_SCHEMA = Type.Union([
  Type.Object({
    kind: Type.Literal("elapsed"),
    elapsedMinutes: Type.Integer({ minimum: 1 }),
    reason: NON_EMPTY_STRING_SCHEMA,
  }),
  Type.Object({
    kind: Type.Literal("travel"),
    location: LOCATION_STATE_SCHEMA,
    elapsedMinutes: Type.Integer({ minimum: 1 }),
    reason: NON_EMPTY_STRING_SCHEMA,
  }),
]);

const TURN_LOG_ENTRY_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  summary: NON_EMPTY_STRING_SCHEMA,
  startedAt: ISO_INSTANT_SCHEMA,
  endedAt: ISO_INSTANT_SCHEMA,
  time: TURN_TIME_POLICY_STATE_SCHEMA,
  eventCount: NON_NEGATIVE_INTEGER_SCHEMA,
  resultCount: NON_NEGATIVE_INTEGER_SCHEMA,
});

export const PUBLIC_GAME_STATE_SCHEMA = Type.Object({
  campaign: CAMPAIGN_STATE_SCHEMA,
  clock: CLOCK_STATE_SCHEMA,
  scene: SCENE_STATE_SCHEMA,
  actors: Type.Record(Type.String(), PUBLIC_ACTOR_STATE_SCHEMA),
  trackedItems: Type.Record(Type.String(), TRACKED_ITEM_STATE_SCHEMA),
  protagonistActorId: NON_EMPTY_STRING_SCHEMA,
  allyActorIds: NON_EMPTY_STRING_ARRAY_SCHEMA,
  economy: ECONOMY_STATE_SCHEMA,
  memory: CAMPAIGN_MEMORY_SCHEMA,
  turnLog: Type.Array(TURN_LOG_ENTRY_SCHEMA),
});

export const SECRET_REVEAL_STATES = ["hidden", "foreshadowed", "revealed"] as const;
const SECRET_REVEAL_STATE_SCHEMA = stringEnumSchema(SECRET_REVEAL_STATES);

const STRING_SECRET_SLOT_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  value: NON_EMPTY_STRING_SCHEMA,
  revealState: SECRET_REVEAL_STATE_SCHEMA,
  revealConditions: NON_EMPTY_STRING_ARRAY_SCHEMA,
});

const NOBLE_PHANTASM_SECRET_SLOT_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  value: NOBLE_PHANTASM_SCHEMA,
  revealState: SECRET_REVEAL_STATE_SCHEMA,
  revealConditions: NON_EMPTY_STRING_ARRAY_SCHEMA,
});

const ACTOR_SECRET_SLOTS_SCHEMA = Type.Object({
  actorId: NON_EMPTY_STRING_SCHEMA,
  trueName: Type.Optional(STRING_SECRET_SLOT_SCHEMA),
  hiddenNoblePhantasms: Type.Array(NOBLE_PHANTASM_SECRET_SLOT_SCHEMA),
  privateMotives: Type.Array(STRING_SECRET_SLOT_SCHEMA),
  unrevealedAffiliations: Type.Array(STRING_SECRET_SLOT_SCHEMA),
});

const SECRET_CAMPAIGN_FACT_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  text: NON_EMPTY_STRING_SCHEMA,
  relatedActorIds: NON_EMPTY_STRING_ARRAY_SCHEMA,
  revealState: SECRET_REVEAL_STATE_SCHEMA,
});

const SECRET_EVENT_MEMORY_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  time: ISO_INSTANT_SCHEMA,
  summary: NON_EMPTY_STRING_SCHEMA,
  relatedActorIds: NON_EMPTY_STRING_ARRAY_SCHEMA,
});

const OFFSCREEN_EVENT_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  lineId: NON_EMPTY_STRING_SCHEMA,
  actorIds: NON_EMPTY_STRING_ARRAY_SCHEMA,
  timeRange: Type.Object({ start: ISO_INSTANT_SCHEMA, end: ISO_INSTANT_SCHEMA }),
  visibility: OFFSCREEN_EVENT_VISIBILITY_SCHEMA,
  summary: NON_EMPTY_STRING_SCHEMA,
  consequences: NON_EMPTY_STRING_ARRAY_SCHEMA,
  futureHooks: NON_EMPTY_STRING_ARRAY_SCHEMA,
  createdFrom: OFFSCREEN_EVENT_SOURCE_SCHEMA,
});

export const SECRET_GAME_STATE_SCHEMA = Type.Object({
  actorSecrets: Type.Record(Type.String(), ACTOR_SECRET_SLOTS_SCHEMA),
  campaignSecrets: Type.Array(SECRET_CAMPAIGN_FACT_SCHEMA),
  secretEventLog: Type.Array(SECRET_EVENT_MEMORY_SCHEMA),
  offscreenEventLog: Type.Array(OFFSCREEN_EVENT_SCHEMA),
});

export const STATE_SCHEMA = Type.Object({
  meta: STATE_META_SCHEMA,
  public: PUBLIC_GAME_STATE_SCHEMA,
  secrets: SECRET_GAME_STATE_SCHEMA,
});

type SchemaState = Static<typeof STATE_SCHEMA>;

/**
 * 双向赋值检查：schema 与 state.ts 手写接口任何一边漂移（加字段、改类型、
 * 改枚举）都会让 tsc 在这里报错，杜绝“改了 schema 漏改校验器被静默放过”。
 */
type AssertAssignable<T extends U, U> = T;
export type StateSchemaParityCheck = [
  AssertAssignable<SchemaState, State>,
  AssertAssignable<State, SchemaState>,
];

// Compile 必须在独立常量上调用：带注解的上下文类型会干扰泛型推导，把 Validator 退化成 unknown。
const COMPILED_STATE_VALIDATOR = Compile(STATE_SCHEMA);
const STATE_VALIDATOR: TypeBoxValidator<State> = COMPILED_STATE_VALIDATOR;

export function parseStateSchema(value: unknown): State {
  const prepared = applyDeserializationDefaults(trimStringsDeep(value));
  const state = parseTypeBoxValue<State>(prepared, "state", STATE_VALIDATOR);
  normalizeStateDatesInPlace(state);
  assertStateInvariants(state);
  return state;
}

/** 旧档兼容：secrets.offscreenEventLog 缺失时按空数组处理。 */
function applyDeserializationDefaults(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const secrets = value["secrets"];
  if (isRecord(secrets) && secrets["offscreenEventLog"] === undefined) {
    secrets["offscreenEventLog"] = [];
  }
  return value;
}

/** ISO 时间字段统一走 normalizeIsoInstant：校验格式并归一化为 canonical 形式。 */
function normalizeStateDatesInPlace(state: State): void {
  state.meta.createdAt = normalizeIsoInstant(state.meta.createdAt, "meta.createdAt");
  state.meta.updatedAt = normalizeIsoInstant(state.meta.updatedAt, "meta.updatedAt");

  const clock = state.public.clock;
  clock.startedAt = normalizeIsoInstant(clock.startedAt, "clock.startedAt");
  clock.currentAt = normalizeIsoInstant(clock.currentAt, "clock.currentAt");
  if (clock.lastLongRestAt !== null) {
    clock.lastLongRestAt = normalizeIsoInstant(clock.lastLongRestAt, "clock.lastLongRestAt");
  }

  state.public.scene.lastResolvedAt = normalizeIsoInstant(
    state.public.scene.lastResolvedAt,
    "scene.lastResolvedAt",
  );

  for (const [index, entry] of state.public.turnLog.entries()) {
    entry.startedAt = normalizeIsoInstant(entry.startedAt, `turnLog[${index}].startedAt`);
    entry.endedAt = normalizeIsoInstant(entry.endedAt, `turnLog[${index}].endedAt`);
  }

  for (const actor of Object.values(state.public.actors)) {
    if (actor.servantForm === null) {
      continue;
    }
    for (const modifier of actor.servantForm.parameters.modifiers) {
      if (modifier.expiresAt !== null) {
        modifier.expiresAt = normalizeIsoInstant(modifier.expiresAt, "modifier.expiresAt");
      }
    }
  }

  const memory = state.public.memory;
  for (const fact of memory.pinnedFacts) {
    fact.since = normalizeIsoInstant(fact.since, "memoryFact.since");
  }
  for (const event of memory.eventLog) {
    event.time = normalizeIsoInstant(event.time, "majorEvent.time");
  }
  for (const dailySummary of memory.dailySummaries) {
    dailySummary.startDate = normalizeIsoInstant(dailySummary.startDate, "dailySummary.startDate");
    dailySummary.endDate = normalizeIsoInstant(dailySummary.endDate, "dailySummary.endDate");
  }

  for (const event of state.secrets.secretEventLog) {
    event.time = normalizeIsoInstant(event.time, "secretEvent.time");
  }
  for (const event of state.secrets.offscreenEventLog) {
    event.timeRange.start = normalizeIsoInstant(
      event.timeRange.start,
      "offscreenEvent.timeRange.start",
    );
    event.timeRange.end = normalizeIsoInstant(event.timeRange.end, "offscreenEvent.timeRange.end");
  }
}

/** schema 表达不了的跨字段不变量：registry key 一致性与 actor 引用完整性。 */
function assertStateInvariants(state: State): void {
  const actors = state.public.actors;

  for (const [actorId, actor] of Object.entries(actors)) {
    if (actor.id !== actorId) {
      throw new Error(`actor registry key ${actorId} 与 actor.id ${actor.id} 不一致。`);
    }
    for (const role of actor.roles) {
      if (role.kind === "master" && role.commandSpells.remaining > role.commandSpells.total) {
        throw new Error("非法 commandSpells: remaining 不能大于 total。");
      }
    }
  }

  assertActorExists(state.public.protagonistActorId, actors, "protagonistActorId");
  for (const actorId of state.public.allyActorIds) {
    assertActorExists(actorId, actors, "allyActorIds[]");
  }
  for (const actorId of state.public.scene.presentActorIds) {
    assertActorExists(actorId, actors, "scene.presentActorIds[]");
  }

  for (const [itemId, item] of Object.entries(state.public.trackedItems)) {
    if (item.id !== itemId) {
      throw new Error(`trackedItems key ${itemId} 与 item.id ${item.id} 不一致。`);
    }
    if (item.ownerActorId !== null) {
      assertActorExists(item.ownerActorId, actors, "item.ownerActorId");
    }
    if (item.holderActorId !== null) {
      assertActorExists(item.holderActorId, actors, "item.holderActorId");
    }
  }

  for (const purse of state.public.economy.accessibleFunds) {
    assertActorExists(purse.ownerActorId, actors, "purse.ownerActorId");
  }
  for (const debt of state.public.economy.debts) {
    assertActorExists(debt.debtorActorId, actors, "debt.debtorActorId");
  }

  for (const [actorId, slots] of Object.entries(state.secrets.actorSecrets)) {
    if (slots.actorId !== actorId) {
      throw new Error(`actorSecrets key ${actorId} 与 actorId ${slots.actorId} 不一致。`);
    }
  }
}

function assertActorExists(
  actorId: string,
  actors: State["public"]["actors"],
  fieldName: string,
): void {
  if (actors[actorId] === undefined) {
    throw new Error(`非法${fieldName}: actor ${actorId} 不存在。`);
  }
}
