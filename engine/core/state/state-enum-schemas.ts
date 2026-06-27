import type { Static } from "typebox";

import { Type } from "typebox";

/**
 * Campaign 链路字符串枚举的单一事实来源。
 *
 * 每个枚举只在这里的 values 数组写一遍，同时驱动三个消费方：
 * - TS 类型：经 Static<> 推导，由 state.ts 以原名 re-export，消费方零改动；
 * - TypeBox schema：JSON Schema enum 关键字，走 typebox-validation.ts 的
 *   中文报错（"必须是允许值之一: ..."）；
 * - 运行时允许值数组：assertState 与工具边界直接复用。
 *
 * 注意 tools/registry.ts 的 parameters schema 故意保持松（枚举写在
 * description 里），不从这里引用——那一层是 LLM-facing 文档，职责不同。
 */
export function stringEnumSchema<const T extends readonly string[]>(values: T) {
  return Type.Unsafe<T[number]>({ enum: [...values] });
}

// ---------------------------------------------------------------------------
// Rule Sets — LOTM 规则集
// ---------------------------------------------------------------------------

export const RULE_SET_IDS = [
  "lotm-worldview-filter",
  "lotm-judgment-combat",
  "lotm-economy",
  "lotm-sequence-promotion",
  "custom",
] as const;
export const RULE_SET_ID_SCHEMA = stringEnumSchema(RULE_SET_IDS);
export type RuleSetId = Static<typeof RULE_SET_ID_SCHEMA>;

// ---------------------------------------------------------------------------
// Timelines — LOTM 世界线
// ---------------------------------------------------------------------------

export const TIMELINE_IDS = [
  "tingen",
  "backlund",
  "bayam",
  "condat",
  "fifth-epoch-1349",
  "custom",
] as const;
export const TIMELINE_ID_SCHEMA = stringEnumSchema(TIMELINE_IDS);
export type TimelineId = Static<typeof TIMELINE_ID_SCHEMA>;

// ---------------------------------------------------------------------------
// Time Zones — 保留 ISO timezone 框架，LOTM 世界内用固定时区
// ---------------------------------------------------------------------------

export const TIMEZONE_IDS = ["UTC"] as const;
export const TIMEZONE_ID_SCHEMA = stringEnumSchema(TIMEZONE_IDS);
export type TimeZoneId = Static<typeof TIMEZONE_ID_SCHEMA>;

// ---------------------------------------------------------------------------
// Currency — LOTM 货币（便士 / 金镑）
// ---------------------------------------------------------------------------

export const CURRENCY_CODES = ["penny", "gold-pound", "custom"] as const;
export const CURRENCY_CODE_SCHEMA = stringEnumSchema(CURRENCY_CODES);
export type CurrencyCode = Static<typeof CURRENCY_CODE_SCHEMA>;

// ---------------------------------------------------------------------------
// Opening Modes
// ---------------------------------------------------------------------------

export const OPENING_MODES = ["random", "selected", "custom"] as const;
export const OPENING_MODE_SCHEMA = stringEnumSchema(OPENING_MODES);
export type OpeningMode = Static<typeof OPENING_MODE_SCHEMA>;

// ---------------------------------------------------------------------------
// Boundary Kinds — LOTM 场景边界
// ---------------------------------------------------------------------------

export const BOUNDARY_KINDS = ["normal", "sacred-domain", "otherworld", "sealed"] as const;
export const BOUNDARY_KIND_SCHEMA = stringEnumSchema(BOUNDARY_KINDS);
export type BoundaryKind = Static<typeof BOUNDARY_KIND_SCHEMA>;

// ---------------------------------------------------------------------------
// Situation Kinds — LOTM 场景类型
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Purse Access
// ---------------------------------------------------------------------------

export const PURSE_ACCESSES = ["held", "shared", "requires-permission"] as const;
export const PURSE_ACCESS_SCHEMA = stringEnumSchema(PURSE_ACCESSES);
export type PurseAccess = Static<typeof PURSE_ACCESS_SCHEMA>;

// ---------------------------------------------------------------------------
// Memory Scopes
// ---------------------------------------------------------------------------

export const MEMORY_SCOPES = ["protagonist", "npc", "faction", "world"] as const;
export const MEMORY_SCOPE_SCHEMA = stringEnumSchema(MEMORY_SCOPES);
export type MemoryFactScope = Static<typeof MEMORY_SCOPE_SCHEMA>;

// ---------------------------------------------------------------------------
// Reveal Statuses — 通用揭示状态
// ---------------------------------------------------------------------------

export const REVEAL_STATUSES = ["hidden", "suspected", "revealed"] as const;
export const REVEAL_STATUS_SCHEMA = stringEnumSchema(REVEAL_STATUSES);
export type RevealStatus = Static<typeof REVEAL_STATUS_SCHEMA>;

// ---------------------------------------------------------------------------
// Offscreen Event
// ---------------------------------------------------------------------------

export const OFFSCREEN_EVENT_VISIBILITIES = ["secret", "foreshadowed", "player-known"] as const;
export const OFFSCREEN_EVENT_VISIBILITY_SCHEMA = stringEnumSchema(OFFSCREEN_EVENT_VISIBILITIES);
export type OffscreenEventVisibility = Static<typeof OFFSCREEN_EVENT_VISIBILITY_SCHEMA>;

export const OFFSCREEN_EVENT_SOURCES = ["parallel-line-subagent", "gm", "debug"] as const;
export const OFFSCREEN_EVENT_SOURCE_SCHEMA = stringEnumSchema(OFFSCREEN_EVENT_SOURCES);
export type OffscreenEventSource = Static<typeof OFFSCREEN_EVENT_SOURCE_SCHEMA>;

// ---------------------------------------------------------------------------
// Actor — LOTM 角色类型
// ---------------------------------------------------------------------------

export const ACTOR_KINDS = ["human", "beyonder", "creature", "other"] as const;
export const ACTOR_KIND_SCHEMA = stringEnumSchema(ACTOR_KINDS);
export type ActorKind = Static<typeof ACTOR_KIND_SCHEMA>;

export const ACTOR_STANCES = [
  "self",
  "ally",
  "friendly",
  "neutral",
  "wary",
  "hostile",
  "unknown",
] as const;
export const ACTOR_STANCE_SCHEMA = stringEnumSchema(ACTOR_STANCES);
export type ActorStance = Static<typeof ACTOR_STANCE_SCHEMA>;

// ---------------------------------------------------------------------------
// Pathway — LOTM 22 条标准途径
// ---------------------------------------------------------------------------

export const PATHWAY_IDS = [
  "seer", // 占卜家
  "apprentice", // 学徒
  "thief", // 偷盗者
  "mystery-prayer", // 秘祈人
  "spectator", // 观众
  "sailor", // 水手
  "bard", // 歌颂者
  "reader", // 阅读者
  "warrior", // 战士
  "sleepless", // 不眠者
  "grave-keeper", // 收尸人
  "hunter", // 猎人
  "assassin", // 刺客
  "savant", // 通识者
  "secret-pryer", // 窥秘人
  "monster", // 怪物
  "apothecary", // 药师
  "cultivator", // 耕种者
  "ruffian", // 恶棍
  "arbiter", // 仲裁人
  "lawyer", // 律师
  "broker", // 掮客
  "custom",
] as const;
export const PATHWAY_ID_SCHEMA = stringEnumSchema(PATHWAY_IDS);
export type PathwayId = Static<typeof PATHWAY_ID_SCHEMA>;

// ---------------------------------------------------------------------------
// Sequence Rank — LOTM 序列等级
// ---------------------------------------------------------------------------

export const SEQUENCE_RANKS = [
  "seq-9",
  "seq-8",
  "seq-7",
  "seq-6",
  "seq-5",
  "seq-4",
  "seq-3",
  "seq-2",
  "seq-1",
  "seq-0",
  "old-one", // 旧日
  "pillar", // 支柱
  "ordinary", // 普通人
] as const;
export const SEQUENCE_RANK_SCHEMA = stringEnumSchema(SEQUENCE_RANKS);
export type SequenceRank = Static<typeof SEQUENCE_RANK_SCHEMA>;

// ---------------------------------------------------------------------------
// Status Effect — LOTM 状态效果
// ---------------------------------------------------------------------------

export const STATUS_EFFECT_TYPES = ["buff", "debuff", "risk", "flag"] as const;
export const STATUS_EFFECT_TYPE_SCHEMA = stringEnumSchema(STATUS_EFFECT_TYPES);
export type StatusEffectType = Static<typeof STATUS_EFFECT_TYPE_SCHEMA>;

export const VALUE_TYPES = ["percentage", "fixed"] as const;
export const VALUE_TYPE_SCHEMA = stringEnumSchema(VALUE_TYPES);
export type ValueType = Static<typeof VALUE_TYPE_SCHEMA>;

// ---------------------------------------------------------------------------
// Damage Type — LOTM 伤害类型
// ---------------------------------------------------------------------------

export const DAMAGE_TYPES = ["physical", "mystical", "mental", "mixed"] as const;
export const DAMAGE_TYPE_SCHEMA = stringEnumSchema(DAMAGE_TYPES);
export type DamageType = Static<typeof DAMAGE_TYPE_SCHEMA>;

// ---------------------------------------------------------------------------
// Difficulty — LOTM 判定难度
// ---------------------------------------------------------------------------

export const DIFFICULTY_LEVELS = [
  "trivial", // 轻而易举
  "ordinary", // 寻常之事
  "tricky", // 颇为棘手
  "near-impossible", // 九死一生
  "blasphemous", // 亵渎之举
] as const;
export const DIFFICULTY_LEVEL_SCHEMA = stringEnumSchema(DIFFICULTY_LEVELS);
export type DifficultyLevel = Static<typeof DIFFICULTY_LEVEL_SCHEMA>;

// ---------------------------------------------------------------------------
// Judgment Result — LOTM 判定结果
// ---------------------------------------------------------------------------

export const JUDGMENT_OUTCOMES = [
  "blessed", // 命运的眷顾
  "perfect", // 完美掌控
  "narrow-success", // 勉力成功
  "failure", // 尝试失败
  "loss-of-control", // 失控预兆
] as const;
export const JUDGMENT_OUTCOME_SCHEMA = stringEnumSchema(JUDGMENT_OUTCOMES);
export type JudgmentOutcome = Static<typeof JUDGMENT_OUTCOME_SCHEMA>;

// ---------------------------------------------------------------------------
// Promotion System — LOTM 晋升体系
// ---------------------------------------------------------------------------

export const PROMOTION_SYSTEMS = ["potion", "other"] as const;
export const PROMOTION_SYSTEM_SCHEMA = stringEnumSchema(PROMOTION_SYSTEMS);
export type PromotionSystem = Static<typeof PROMOTION_SYSTEM_SCHEMA>;

// ---------------------------------------------------------------------------
// Tracked Items — LOTM 物品类型
// ---------------------------------------------------------------------------

export const TRACKED_ITEM_KINDS = [
  "mundane",
  "weapon",
  "sealed-artifact", // 封印物
  "mystical-item", // 非凡物品
  "document",
  "key-item",
  "consumable",
  "other",
] as const;
export const TRACKED_ITEM_KIND_SCHEMA = stringEnumSchema(TRACKED_ITEM_KINDS);
export type TrackedItemKind = Static<typeof TRACKED_ITEM_KIND_SCHEMA>;

export const TRACKED_ITEM_CONDITIONS = ["intact", "damaged", "broken", "spent", "unknown"] as const;
export const TRACKED_ITEM_CONDITION_SCHEMA = stringEnumSchema(TRACKED_ITEM_CONDITIONS);
export type TrackedItemCondition = Static<typeof TRACKED_ITEM_CONDITION_SCHEMA>;

export const TRACKED_ITEM_VISIBILITIES = ["player-known", "suspected"] as const;
export const TRACKED_ITEM_VISIBILITY_SCHEMA = stringEnumSchema(TRACKED_ITEM_VISIBILITIES);
export type TrackedItemVisibility = Static<typeof TRACKED_ITEM_VISIBILITY_SCHEMA>;

// ---------------------------------------------------------------------------
// Scene Threat Severity
// ---------------------------------------------------------------------------

export const SCENE_THREAT_SEVERITIES = ["low", "medium", "high", "lethal"] as const;
export const SCENE_THREAT_SEVERITY_SCHEMA = stringEnumSchema(SCENE_THREAT_SEVERITIES);
export type SceneThreatSeverity = Static<typeof SCENE_THREAT_SEVERITY_SCHEMA>;

// ---------------------------------------------------------------------------
// Six Attribute Keys — LOTM 六维属性
// ---------------------------------------------------------------------------

export const ATTRIBUTE_KEYS = [
  "vitality", // 活力
  "spirituality", // 灵性
  "reason", // 理智
  "humanity", // 人性
  "agility", // 敏捷
  "luck", // 运气
] as const;
export const ATTRIBUTE_KEY_SCHEMA = stringEnumSchema(ATTRIBUTE_KEYS);
export type AttributeKey = Static<typeof ATTRIBUTE_KEY_SCHEMA>;
