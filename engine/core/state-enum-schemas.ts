import type { Static } from "typebox";

import { Type } from "typebox";

/**
 * Campaign 链路字符串枚举的单一事实来源。
 *
 * 每个枚举只在这里的 values 数组写一遍，同时驱动三个消费方：
 * - TS 类型：经 Static<> 推导，由 state.ts 以原名 re-export，消费方零改动；
 * - TypeBox schema：JSON Schema enum 关键字，走 typebox-validation.ts 的
 *   中文报错（“必须是允许值之一: ...”）；
 * - 运行时允许值数组：assertState 与工具边界直接复用。
 *
 * 注意 tools/registry.ts 的 parameters schema 故意保持松（枚举写在
 * description 里），不从这里引用——那一层是 LLM-facing 文档，职责不同。
 */
export function stringEnumSchema<const T extends readonly string[]>(values: T) {
  return Type.Unsafe<T[number]>({ enum: [...values] });
}

export const RULE_SET_IDS = [
  "fate-worldview-filter",
  "fate-rank-combat",
  "jpy-2004-economy",
  "moon-cell-seraph",
  "moon-cell-far-side",
  "custom",
] as const;
export const RULE_SET_ID_SCHEMA = stringEnumSchema(RULE_SET_IDS);
export type RuleSetId = Static<typeof RULE_SET_ID_SCHEMA>;

export const TIMELINE_IDS = [
  "fz",
  "fsn",
  "case-files",
  "fsf",
  "extra",
  "extra-ccc",
  "mahoyo",
  "kara-no-kyoukai",
  "tsukihime-2000",
  "tsukihime-2021",
  "custom",
] as const;
export const TIMELINE_ID_SCHEMA = stringEnumSchema(TIMELINE_IDS);
export type TimelineId = Static<typeof TIMELINE_ID_SCHEMA>;

export const TIMEZONE_IDS = ["Asia/Tokyo", "America/Denver", "UTC"] as const;
export const TIMEZONE_ID_SCHEMA = stringEnumSchema(TIMEZONE_IDS);
export type TimeZoneId = Static<typeof TIMEZONE_ID_SCHEMA>;

export const CURRENCY_CODES = ["JPY", "USD", "custom"] as const;
export const CURRENCY_CODE_SCHEMA = stringEnumSchema(CURRENCY_CODES);
export type CurrencyCode = Static<typeof CURRENCY_CODE_SCHEMA>;

export const OPENING_MODES = ["random", "selected", "custom"] as const;
export const OPENING_MODE_SCHEMA = stringEnumSchema(OPENING_MODES);
export type OpeningMode = Static<typeof OPENING_MODE_SCHEMA>;

export const BOUNDARY_KINDS = ["normal", "bounded-field", "reality-marble", "otherworld"] as const;
export const BOUNDARY_KIND_SCHEMA = stringEnumSchema(BOUNDARY_KINDS);
export type BoundaryKind = Static<typeof BOUNDARY_KIND_SCHEMA>;

export const SITUATION_KINDS = [
  "daily",
  "investigation",
  "social",
  "combat",
  "ritual",
  "escape",
  "downtime",
] as const;
export const SITUATION_KIND_SCHEMA = stringEnumSchema(SITUATION_KINDS);
export type SituationKind = Static<typeof SITUATION_KIND_SCHEMA>;

export const PURSE_ACCESSES = ["held", "shared", "requires-permission"] as const;
export const PURSE_ACCESS_SCHEMA = stringEnumSchema(PURSE_ACCESSES);
export type PurseAccess = Static<typeof PURSE_ACCESS_SCHEMA>;

export const MEMORY_SCOPES = ["protagonist", "npc", "faction", "world"] as const;
export const MEMORY_SCOPE_SCHEMA = stringEnumSchema(MEMORY_SCOPES);
export type MemoryFactScope = Static<typeof MEMORY_SCOPE_SCHEMA>;

export const REVEAL_STATUSES = ["hidden", "suspected", "revealed"] as const;
export const REVEAL_STATUS_SCHEMA = stringEnumSchema(REVEAL_STATUSES);
export type RevealStatus = Static<typeof REVEAL_STATUS_SCHEMA>;

export const OFFSCREEN_EVENT_VISIBILITIES = ["secret", "foreshadowed", "player-known"] as const;
export const OFFSCREEN_EVENT_VISIBILITY_SCHEMA = stringEnumSchema(OFFSCREEN_EVENT_VISIBILITIES);
export type OffscreenEventVisibility = Static<typeof OFFSCREEN_EVENT_VISIBILITY_SCHEMA>;

export const OFFSCREEN_EVENT_SOURCES = ["parallel-line-subagent", "gm", "debug"] as const;
export const OFFSCREEN_EVENT_SOURCE_SCHEMA = stringEnumSchema(OFFSCREEN_EVENT_SOURCES);
export type OffscreenEventSource = Static<typeof OFFSCREEN_EVENT_SOURCE_SCHEMA>;

export const CONTRACT_STATUSES = ["stable", "weak", "cut", "masterless"] as const;
export const CONTRACT_STATUS_SCHEMA = stringEnumSchema(CONTRACT_STATUSES);
export type ContractStatus = Static<typeof CONTRACT_STATUS_SCHEMA>;

export const MANA_SUPPLIES = ["sufficient", "strained", "starved"] as const;
export const MANA_SUPPLY_SCHEMA = stringEnumSchema(MANA_SUPPLIES);
export type ManaSupply = Static<typeof MANA_SUPPLY_SCHEMA>;

export const SCENE_THREAT_SEVERITIES = ["low", "medium", "high", "lethal"] as const;
export const SCENE_THREAT_SEVERITY_SCHEMA = stringEnumSchema(SCENE_THREAT_SEVERITIES);
export type SceneThreatSeverity = Static<typeof SCENE_THREAT_SEVERITY_SCHEMA>;

export const FATE_PARAM_KEYS = [
  "strength",
  "endurance",
  "agility",
  "mana",
  "luck",
  "noblePhantasm",
] as const;
export const FATE_PARAM_KEY_SCHEMA = stringEnumSchema(FATE_PARAM_KEYS);
export type FateParamKey = Static<typeof FATE_PARAM_KEY_SCHEMA>;
