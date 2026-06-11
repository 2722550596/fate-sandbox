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
  ParallelLineTimeWindow,
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
export type Percent = number;

export interface GameState {
  meta: StateMeta;
  public: PublicGameState;
  secrets: SecretGameState;
}

export interface StateMeta {
  schemaVersion: 3;
  createdAt: string;
  updatedAt: string;
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
}

export interface SecretGameState {
  actorSecrets: Record<ActorId, ActorSecretSlots>;
  campaignSecrets: SecretCampaignFact[];
  secretEventLog: SecretEventMemory[];
  offscreenEventLog: OffscreenEvent[];
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
  displayName: string;
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
  heldTrackedItemIds: ItemId[];
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
  strength: FateRank;
  endurance: FateRank;
  agility: FateRank;
  mana: FateRank;
  luck: FateRank;
  noblePhantasm: FateRank;
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

export const CURRENT_STATE_SCHEMA_VERSION = 3;
