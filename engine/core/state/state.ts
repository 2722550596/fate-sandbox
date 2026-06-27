import type { OffscreenEvent } from "../backstage/parallel-line.ts";
import type {
  ActorKind,
  ActorStance,
  BoundaryKind,
  CurrencyCode,
  MemoryFactScope,
  OpeningMode,
  PathwayId,
  PromotionSystem,
  PurseAccess,
  RuleSetId,
  SceneThreatSeverity,
  SequenceRank,
  SituationKind,
  TimelineId,
  TimeZoneId,
  TrackedItemCondition,
  TrackedItemKind,
  TrackedItemVisibility,
  ValueType,
  StatusEffectType,
} from "./state-enum-schemas.ts";

export type {
  OffscreenEvent,
  OffscreenEventSource,
  OffscreenEventVisibility,
  ParallelLineInput,
  ParallelLineOutput,
  ParallelLineOutcome,
  ParallelLinePressureSlotHint,
  ParallelLineRecentEvent,
  ParallelLineTimeWindow,
  ParallelLineToneDriftRisk,
} from "../backstage/parallel-line.ts";

export type {
  ActorKind,
  ActorStance,
  BoundaryKind,
  CurrencyCode,
  MemoryFactScope,
  OpeningMode,
  PathwayId,
  PromotionSystem,
  PurseAccess,
  RuleSetId,
  SceneThreatSeverity,
  SequenceRank,
  SituationKind,
  StatusEffectType,
  TimelineId,
  TimeZoneId,
  TrackedItemCondition,
  TrackedItemKind,
  TrackedItemVisibility,
  ValueType,
} from "./state-enum-schemas.ts";

export type ActorId = string;
export type ItemId = string;
export type SceneObjectiveId = string;
export type SceneThreatId = string;
export type StoryArcId = string;
export type StoryBeatId = string;
export type MemoryFactId = string;
export type MajorEventMemoryId = string;
export type DailySummaryMemoryId = string;
export type SceneObjectiveStatus = "active" | "blocked" | "resolved";
export type Percent = number;

// ---------------------------------------------------------------------------
// Core State Tree
// ---------------------------------------------------------------------------

export interface GameState {
  meta: StateMeta;
  public: PublicGameState;
  secrets: SecretGameState;
}

export interface StateMeta {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  rngSeed: number;
  rngCounter: number;
}

export interface PublicGameState {
  campaign: CampaignState;
  clock: ClockState;
  scene: SceneState;
  actors: Record<ActorId, PublicActorState>;
  trackedItems: Record<ItemId, TrackedItemState>;
  protagonistActorId: ActorId;
  allyActorIds: ActorId[];
  economy: EconomyState;
  memory: CampaignMemory;
  turnLog: TurnLogEntry[];
  obligations: TurnObligation[];
  hooks: HookState[];
  relationshipSignals: RelationshipSignal[];
  actorImpressions: Record<ActorId, ActorImpression>;
}

export type HookStatus = "active" | "parked" | "paid" | "escalated" | "retired";

export interface HookState {
  id: string;
  label: string;
  status: HookStatus;
  lastSurfacedAt: string;
  surfaceCount: number;
  lastNovelty: string;
}

export type TurnObligationKind =
  | "scene-objective"
  | "scene-threat"
  | "actor-condition"
  | "sequence"
  | "memory"
  | "reveal-secret";

export interface TurnObligation {
  id: string;
  source: string;
  kind: TurnObligationKind;
  summary: string;
  createdAt: string;
}

export interface SecretGameState {
  actorStates: Record<ActorId, SecretActorState>;
  campaignSecrets: SecretCampaignFact[];
  secretEventLog: SecretEventMemory[];
  offscreenEventLog: OffscreenEvent[];
  factionClocks: FactionClock[];
  scheduledEvents: ScheduledEvent[];
  relationshipSignals: RelationshipSignal[];
  backstageObligations: BackstageObligation[];
  backstageReviewLog: BackstageReviewEntry[];
  backstagePressure: BackstagePressureState;
  backstagePendingHarvests: BackstagePendingHarvest[];
}

export type BackstageTrigger = "time-advance" | "beat-complete" | "no-cost-streak";

export interface BackstageObligation {
  id: string;
  trigger: BackstageTrigger;
  summary: string;
  createdAt: string;
}

export type BackstageResolutionOutcome = "landed" | "no-change" | "blocked";

export interface BackstageReviewEntry {
  id: string;
  obligationId: string;
  outcome: BackstageResolutionOutcome;
  reasonCode: string;
  note: string;
  reviewedAt: string;
}

export interface BackstagePressureState {
  consecutiveNoCostTurns: number;
}

export interface BackstagePendingHarvest {
  runId: string;
  lineId: string;
  spawnedAt: string;
}

export interface SecretActorState {
  actorId: ActorId;
  secrets?: ActorSecretSlots;
  agenda?: ActorAgendaState;
  knowledgeLens?: ActorKnowledgeLens;
}

export interface ActorAgendaState {
  actorId: ActorId;
  goal: string;
  fear: string;
  currentOrder: string | null;
  lastIndependentActionAt: string | null;
}

export interface ActorKnowledgeLens {
  actorId: ActorId;
  knows: string[];
  suspects: string[];
  falseBeliefs: string[];
  forbiddenKnowledge: string[];
}

export type RelationshipSignalVisibility = "player-known" | "secret";

export interface RelationshipSignal {
  id: string;
  actorId: ActorId;
  targetActorId: ActorId;
  signal: string;
  interpretation: string;
  boundary: string;
  sourceEventId: string | null;
  visibility: RelationshipSignalVisibility;
}

export interface FactionClock {
  id: string;
  factionId: string;
  label: string;
  filled: number;
  size: number;
  visibility: "hidden" | "leaked";
}

export interface ScheduledEvent {
  id: string;
  dueAt: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

export interface CampaignState {
  title: string;
  timeline: TimelineId;
  openingMode: OpeningMode;
  premise: string;
  activeRuleSetIds: RuleSetId[];
}

// ---------------------------------------------------------------------------
// Clock — 内部用 ISO 存储，显示时转换为第五纪历法
// ---------------------------------------------------------------------------

export interface ClockState {
  startedAt: string;
  currentAt: string;
  timezone: TimeZoneId;
  lastLongRestAt: string | null;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export interface SceneState {
  location: LocationState;
  situation: SituationKind;
  storyWindow: StoryWindowState | null;
  presentActorIds: ActorId[];
  objectives: SceneObjective[];
  threats: SceneThreat[];
  lastResolvedAt: string;
}

export interface StoryWindowState {
  currentArcId: StoryArcId;
  currentBeatId: StoryBeatId;
  title: string;
  allowedActions: string[];
  forbiddenEscalations: string[];
  completionCriteria: string[];
  nextBeatHints: string[];
}

export interface SceneObjective {
  id: SceneObjectiveId;
  summary: string;
  status: SceneObjectiveStatus;
}

export interface SceneThreat {
  id: SceneThreatId;
  summary: string;
  severity: SceneThreatSeverity;
}

export type TurnTimePolicy =
  | { kind: "elapsed"; elapsedMinutes: number; reason: string }
  | { kind: "travel"; location: LocationState; elapsedMinutes: number; reason: string };

export interface TurnLogEntry {
  id: string;
  summary: string;
  startedAt: string;
  endedAt: string;
  time: TurnTimePolicy;
  eventCount: number;
  resultCount: number;
}

export interface LocationState {
  region: string;
  site: string;
  detail: string;
  boundary: BoundaryKind;
  coordinates: { x: number; y: number } | null;
}

// ---------------------------------------------------------------------------
// Actor — LOTM 角色模型
// ---------------------------------------------------------------------------

export type PublicActorState =
  | HumanActorState
  | BeyonderActorState
  | CreatureActorState
  | OtherActorState;

export interface ActorBase {
  id: ActorId;
  kind: ActorKind;
  roles: ActorRole[];
  sequence: SequenceState | null;
  stats: CharacterStats | null;
  identity: IdentityState;
  presentation: PresentationState;
  condition: ConditionState;
  inventory: InventoryState;
  abilities: AbilityState[];
  relationshipToProtagonist: RelationshipState;
}

export interface HumanActorState extends ActorBase {
  kind: "human";
}

export interface BeyonderActorState extends ActorBase {
  kind: "beyonder";
}

export interface CreatureActorState extends ActorBase {
  kind: "creature";
  origin: string;
}

export interface OtherActorState extends ActorBase {
  kind: "other";
  nature: string;
}

export type ActorRole = SocialRole | FactionRole;

export interface SocialRole {
  kind: "social";
  label: string;
}

export interface FactionRole {
  kind: "faction";
  factionId: string;
  label: string;
}

export interface IdentityState {
  publicIdentity: string;
  background: string;
  lockedFacts: LockedFact[];
}

export interface LockedFact {
  id: string;
  text: string;
}

export interface PresentationState {
  internalName: string;
  renderName: string;
  apparentAge: string;
  outfit: OutfitState;
  demeanor: string;
}

export interface OutfitState {
  label: string;
  details: string;
}

export interface RelationshipState {
  stance: ActorStance;
  summary: string;
}

// ---------------------------------------------------------------------------
// Condition — LOTM 状态效果系统
// ---------------------------------------------------------------------------

export interface ConditionState {
  statusEffects: StatusEffectState[];
}

export interface StatusEffectState {
  id: string;
  name: string;
  type: StatusEffectType;
  affectedAttribute: string;
  valueType: ValueType;
  value: number;
  duration: number;
  source: string;
}

// ---------------------------------------------------------------------------
// Sequence — LOTM 序列/途径状态
// ---------------------------------------------------------------------------

export interface SequenceState {
  currentSequence: string;
  rank: SequenceRank;
  pathway: PathwayId;
  promotionSystem: PromotionSystem;
  divinity: number;
  digestionProgress: number;
  lossOfControlProgress: number;
}

// ---------------------------------------------------------------------------
// Stats — 六维属性三层模型
//
// 每个 actor 持有一组 stats，三层含义：
//   base    — 纯配置运算（序列基准 × 序列权重），只随序列晋升改变
//   max     — base + 效果修正（buff/debuff），调用 recalculateMaxStats 更新
//   current — 受伤害/治疗直接影响，被 max 钳制
// ---------------------------------------------------------------------------

export interface CharacterStats {
  base: StatsValues;
  max: StatsValues;
  current: StatsValues;
}

export interface StatsValues {
  vitality: number;
  agility: number;
  spirituality: number;
  sanity: number;
  humanity: number;
  luck: number;
}

// ---------------------------------------------------------------------------
// Source Castle — LOTM 源堡
// ---------------------------------------------------------------------------

export interface SourceCastleState {
  space: string;
  weeklyChoice: string;
  spiritualityAlignment: number;
}

// ---------------------------------------------------------------------------
// Age — LOTM 年龄系统
// ---------------------------------------------------------------------------

export interface AgeState {
  soulAge: number;
  soulAgeLimit: string | number;
  bodyAge: number;
  bodyAgeLimit: number;
}

// ---------------------------------------------------------------------------
// Inventory & Abilities
// ---------------------------------------------------------------------------

export interface InventoryState {
  ordinaryItems: string[];
}

export interface AbilityState {
  id: string;
  label: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Tracked Items
// ---------------------------------------------------------------------------

export interface TrackedItemState {
  id: ItemId;
  label: string;
  kind: TrackedItemKind;
  ownerActorId: ActorId | null;
  holderActorId: ActorId | null;
  location: LocationState | null;
  condition: TrackedItemCondition;
  visibility: TrackedItemVisibility;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Economy — LOTM 货币（便士 / 金镑）
// ---------------------------------------------------------------------------

export interface EconomyState {
  currency: CurrencyCode;
  accessibleFunds: MoneyPurse[];
  debts: DebtState[];
}

export interface MoneyPurse {
  id: string;
  ownerActorId: ActorId;
  label: string;
  amount: number;
  access: PurseAccess;
}

export interface DebtState {
  id: string;
  debtorActorId: ActorId;
  creditor: string;
  amount: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export interface CampaignMemory {
  pinnedFacts: MemoryFact[];
  eventLog: MajorEventMemory[];
  dailySummaries: DailySummaryMemory[];
}

export interface MemoryFact {
  id: MemoryFactId;
  scope: MemoryFactScope;
  subject: string;
  text: string;
  since: string;
  sourceEventId: string | null;
}

export interface MajorEventMemory {
  id: MajorEventMemoryId;
  time: string;
  title: string;
  summary: string;
  consequences: string[];
}

export interface DailySummaryMemory {
  id: DailySummaryMemoryId;
  startDate: string;
  endDate: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Secrets — LOTM 途径/序列秘密
// ---------------------------------------------------------------------------

export interface ActorSecretSlots {
  actorId: ActorId;
  pathwaySecret?: SecretSlot<string>;
  sequenceSecret?: SecretSlot<string>;
  privateMotives: Array<SecretSlot<string>>;
  unrevealedAffiliations: Array<SecretSlot<string>>;
}

export interface SecretSlot<T> {
  id: string;
  value: T;
  revealState: "hidden" | "foreshadowed" | "revealed";
  revealConditions: string[];
}

export interface SecretCampaignFact {
  id: string;
  text: string;
  relatedActorIds: string[];
  revealState: "hidden" | "foreshadowed" | "revealed";
}

export interface SecretEventMemory {
  id: string;
  time: string;
  summary: string;
  relatedActorIds: string[];
}

// ---------------------------------------------------------------------------
// NPC Impression
// ---------------------------------------------------------------------------

export interface ActorImpression {
  actorId: ActorId;
  presence: string;
  actionStyle: string;
  relationshipPosture: string;
  voiceMaterial: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

export interface TimeExportState extends ClockState {
  displayTime: string;
  date: string;
  weekday: string;
  time: string;
}

export interface StateExport extends Omit<GameState, "public"> {
  public: Omit<PublicGameState, "clock"> & { clock: TimeExportState };
}

export type State = GameState;

export const CURRENT_STATE_SCHEMA_VERSION = 2;
