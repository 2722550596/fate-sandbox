import type { NoblePhantasm } from "./actor-schema.ts";
import type { OffscreenEvent } from "./parallel-line.ts";
import type {
  ActorKind,
  ActorStance,
  BoundaryKind,
  CircuitStatus,
  ContractStatus,
  CurrencyCode,
  ManaSupply,
  MemoryFactScope,
  OpeningMode,
  PurseAccess,
  RevealStatus,
  RuleSetId,
  SceneThreatSeverity,
  ServantClass,
  SituationKind,
  TimelineId,
  TimeZoneId,
  TrackedItemCondition,
  TrackedItemKind,
  TrackedItemVisibility,
  WoundSeverity,
} from "./state-enum-schemas.ts";

export type { NoblePhantasm } from "./actor-schema.ts";

export type {
  ActorKind,
  ActorStance,
  BoundaryKind,
  CircuitStatus,
  ContractStatus,
  CurrencyCode,
  ManaSupply,
  MemoryFactScope,
  OpeningMode,
  PurseAccess,
  RevealStatus,
  RuleSetId,
  SceneThreatSeverity,
  ServantClass,
  SituationKind,
  TimelineId,
  TimeZoneId,
  TrackedItemCondition,
  TrackedItemKind,
  TrackedItemVisibility,
  WoundSeverity,
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
} from "./parallel-line.ts";

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
export type FateRankBase = "E" | "D" | "C" | "B" | "A" | "EX";
export type FateRank =
  | FateRankBase
  | `${FateRankBase}+`
  | `${FateRankBase}++`
  | `${FateRankBase}+++`
  | `${FateRankBase}-`;
/** 可变输出宝具（如无限剑制 E~A++）的范围评级。 */
export type FateRankRange = `${FateRank}~${FateRank}`;
/** 未知参数：对手尚未被观测/拍板时的占位；战斗比较时走中性路径。 */
export type FateRankOrUnknown = FateRank | "unknown";
export type Percent = number;

export interface GameState {
  meta: StateMeta;
  public: PublicGameState;
  secrets: SecretGameState;
}

export interface StateMeta {
  schemaVersion: 18;
  createdAt: string;
  updatedAt: string;
  /** Seeded RNG seed（backlog #9）：确定性随机源，初始化时生成 */
  rngSeed: number;
  /** Seeded RNG counter：每次消耗 +1，rewind 后重放行为一致 */
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
  /** 裁决已出、尚未落地的强制状态变更；canonical commit 前必须清空 */
  obligations: TurnObligation[];
  /** Mystery hook 账本：hook budget 从 prompt 自觉变成领域对象（backlog #2） */
  hooks: HookState[];
  /** 玩家已知的关系信号证据链；只记录行为证据，不写隐藏内心判词 */
  relationshipSignals: RelationshipSignal[];
  /** NPC 印象卡：voice/posture/texture 蒸馏快照，presence 驱动注入；按 actorId 聚合 */
  actorImpressions: Record<ActorId, ActorImpression>;
}

export type HookStatus = "active" | "parked" | "paid" | "escalated" | "retired";

export interface HookState {
  id: string;
  label: string;
  status: HookStatus;
  /** 上次在正文中出现的游戏内时刻 */
  lastSurfacedAt: string;
  surfaceCount: number;
  /** 上次复现带来的新状态；复现/升级/兑现时必填 */
  lastNovelty: string;
}

export type TurnObligationKind =
  | "scene-objective"
  | "scene-threat"
  | "actor-condition"
  | "servant-form"
  | "memory"
  | "reveal-secret";

export interface TurnObligation {
  id: string;
  /** 产生此义务的裁决源，如 "combat-exchange" */
  source: string;
  kind: TurnObligationKind;
  summary: string;
  /** 登记时的游戏内时钟 */
  createdAt: string;
}

export interface SecretGameState {
  /**
   * GM 对每个 actor 的隐藏内部模型，按 actorId 聚合。
   * 三个 facet（secrets / agenda / knowledgeLens）同生死、同过 removeActorEverywhere 级联。
   * 未来新增的 per-actor 秘密状态应作为 SecretActorState 的新字段，而非新的顶层侧表。
   */
  actorStates: Record<ActorId, SecretActorState>;
  campaignSecrets: SecretCampaignFact[];
  secretEventLog: SecretEventMemory[];
  offscreenEventLog: OffscreenEvent[];
  /** BITD 式阵营进度钟：世界不为玩家暂停的机械载体 */
  factionClocks: FactionClock[];
  /** 到期义务：越过 dueAt 后 canonical commit 会在返回值里催账 */
  scheduledEvents: ScheduledEvent[];
  /** 玩家未确认的关系信号与误判，只给 GM/private resolve/subagent 使用 */
  relationshipSignals: RelationshipSignal[];
  /**
   * 后台世界推进义务账本（backlog #5 runtime 闭环）：触发器命中时生成，
   * 下一 canonical turn 前必须清账（延迟硬阻断）。与 public obligations 独立。
   */
  backstageObligations: BackstageObligation[];
  /** 后台义务的审查记录：candidate 落地 / no-change / blocked 都在此留痕，不污染 public */
  backstageReviewLog: BackstageReviewEntry[];
  /** 后台压力计数：跨回合的连续无代价计数器 */
  backstagePressure: BackstagePressureState;
  /**
   * 待 harvest 的后台 director run（run_parallel_line 起飞即记，harvest 即清）。
   * 引擎据此在 canonical commit 催账，并让 resolve_backstage_line 在有未 harvest run 时
   * 拒绝清账——防止已产出的候选被一句 no-change 静默丢弃。
   */
  backstagePendingHarvests: BackstagePendingHarvest[];
}

/** 生成后台义务的触发源（v1 可检测核心集） */
export type BackstageTrigger = "time-advance" | "beat-complete" | "no-cost-streak";

export interface BackstageObligation {
  id: string;
  trigger: BackstageTrigger;
  summary: string;
  createdAt: string;
}

/** 后台义务的清账结果：landed=落地候选；no-change/blocked=经审查的显式无推进 */
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

/** 已起飞但尚未 harvest 的后台 director run 标记。 */
export interface BackstagePendingHarvest {
  runId: string;
  lineId: string;
  spawnedAt: string;
}

/**
 * 单个 actor 的隐藏聚合：他秘密是什么（secrets）、想要什么（agenda）、知道什么（knowledgeLens）。
 * 三个 facet 都是可选的；bundle.actorId 始终等于其在 actorStates 里的 key。
 * 访问一律走 secret-actor-state.ts 的访问器，不允许裸 nested 写入（由它统一维护空 bundle 修剪）。
 */
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
  /** 阵营/势力标识，自由字符串（尚无阵营 registry） */
  factionId: string;
  label: string;
  filled: number;
  size: number;
  /** hidden = 玩家完全不知；leaked = 玩家已感知到征兆 */
  visibility: "hidden" | "leaked";
}

export interface ScheduledEvent {
  id: string;
  /** 游戏内时钟 ISO；currentAt 越过即到期 */
  dueAt: string;
  summary: string;
}

export interface CampaignState {
  title: string;
  timeline: TimelineId;
  openingMode: OpeningMode;
  premise: string;
  activeRuleSetIds: RuleSetId[];
}

export interface ClockState {
  startedAt: string;
  currentAt: string;
  timezone: TimeZoneId;
  lastLongRestAt: string | null;
}

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
}

export type PublicActorState =
  | HumanActorState
  | OutsiderActorState
  | SpiritActorState
  | OtherActorState;

export interface ActorBase {
  id: ActorId;
  kind: ActorKind;
  roles: ActorRole[];
  magecraft: MagecraftCapability | null;
  servantForm: ServantCoreState | null;
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

export interface OutsiderActorState extends ActorBase {
  kind: "outsider";
  sourceProfile: string;
  fateTranslation: string;
  restrictions: string[];
}

export interface SpiritActorState extends ActorBase {
  kind: "spirit";
  origin: string;
}

export interface OtherActorState extends ActorBase {
  kind: "other";
  nature: string;
}

export type ActorRole = MasterRole | SocialRole | FactionRole;

export interface MasterRole {
  kind: "master";
  commandSpells: CommandSpellState;
  contractedServantIds: ActorId[];
}

export interface SocialRole {
  kind: "social";
  label: string;
}

export interface FactionRole {
  kind: "faction";
  factionId: string;
  label: string;
}

export interface CommandSpellState {
  total: number;
  remaining: number;
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
  /** Renderer-facing surface name; keep exact Chinese/canonical prose spelling here. */
  renderName: string;
  apparentAge: string;
  outfit: OutfitState;
  demeanor: string;
}

export interface OutfitState {
  label: string;
  details: string;
}

export interface MagecraftCapability {
  circuits: MagecraftCircuitState;
  disciplines: MagecraftDiscipline[];
  affiliation: string | null;
}

export interface MagecraftCircuitState {
  count: string;
  quality: FateRank | "none";
  od: Percent;
  status: CircuitStatus;
  traits: string[];
}

export interface MagecraftDiscipline {
  name: string;
  rank: FateRank | "none";
  notes: string;
}

export interface RelationshipState {
  stance: ActorStance;
  summary: string;
}

export interface ConditionState {
  wounds: WoundState[];
  afflictions: AfflictionState[];
  permanentEffects: PermanentEffect[];
}

export interface WoundState {
  id: string;
  severity: WoundSeverity;
  text: string;
  recoverable: boolean;
  treatment: string | null;
}

export interface AfflictionState {
  id: string;
  source: string;
  text: string;
  expectedDuration: string | null;
}

export interface PermanentEffect {
  id: string;
  source: string;
  text: string;
  mechanicalEffect: string;
}

export interface PermanentDefect {
  id: string;
  source: string;
  text: string;
  mechanicalEffect: string;
}

export interface InventoryState {
  ordinaryItems: string[];
}

export interface AbilityState {
  id: string;
  label: string;
  summary: string;
}

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

export interface ServantCoreState {
  identity: ServantIdentityState;
  condition: ServantConditionState;
  contract: ServantContractState;
  parameters: ServantParameterState;
  skills: ServantSkillState;
  noblePhantasms: NoblePhantasm[];
  currentOrder: string;
}

export interface ServantIdentityState {
  className: ServantClass;
  trueName: TrueNameState;
  locked: true;
}

export interface TrueNameState {
  status: RevealStatus;
  display: string;
}

export interface ServantConditionState {
  spiritualCore: ResourceTrack;
  mana: ResourceTrack;
  spiritualCondition: string;
  permanentDefects: PermanentDefect[];
}

export interface ResourceTrack {
  value: Percent;
}

export interface ServantContractState {
  masterActorId: ActorId | null;
  masterName: string | null;
  status: ContractStatus;
  manaSupply: ManaSupply;
}

export interface ServantParameterState {
  base: FateParams;
  modifiers: ParamModifier[];
  baseLocked: true;
}

export interface FateParams {
  strength: FateRankOrUnknown;
  endurance: FateRankOrUnknown;
  agility: FateRankOrUnknown;
  mana: FateRankOrUnknown;
  luck: FateRankOrUnknown;
  noblePhantasm: FateRankOrUnknown;
}

export interface ParamModifier {
  id: string;
  source: string;
  affectedParams: Array<keyof FateParams>;
  summary: string;
  expiresAt: string | null;
}

export interface ServantSkillState {
  classSkills: ServantSkill[];
  personalSkills: ServantSkill[];
}

export interface ServantSkill {
  name: string;
  rank: FateRank | "none";
  summary: string;
}

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

export interface ActorSecretSlots {
  actorId: ActorId;
  trueName?: SecretSlot<string>;
  hiddenNoblePhantasms: Array<SecretSlot<NoblePhantasm>>;
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
  relatedActorIds: ActorId[];
  revealState: "hidden" | "foreshadowed" | "revealed";
}

export interface SecretEventMemory {
  id: string;
  time: string;
  summary: string;
  relatedActorIds: ActorId[];
}

/**
 * NPC 印象卡（backlog #6a）。
 * 公开层，几行即可。beat complete 或 compaction 时由 GM 蒸馏更新；
 * pre-response 注入时只注入当前 scene.presentActorIds 里的卡片。
 */
export interface ActorImpression {
  actorId: ActorId;
  /** 外在气场：给人的第一印象、体格/气质/压迫感（1 行） */
  presence: string;
  /** 行动风格：说话习惯、决策偏好、典型行为模式（1 行） */
  actionStyle: string;
  /** 当前对主角的姿态（1 行） */
  relationshipPosture: string;
  /** 可选：语气材料（口头禅、断句习惯、情绪标记） */
  voiceMaterial: string;
  /** 最后更新时刻（游戏内时钟） */
  updatedAt: string;
}

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

export const CURRENT_STATE_SCHEMA_VERSION = 18;
