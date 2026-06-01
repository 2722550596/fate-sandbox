import type { OffscreenEvent } from "./parallel-line";

import { Temporal } from "@js-temporal/polyfill";
import { mkdirSync, writeFileSync } from "node:fs";

import { formatHumanTime, normalizeIsoInstant, nowIso } from "./date-time";

export type {
  OffscreenEvent,
  OffscreenEventSource,
  OffscreenEventVisibility,
  ParallelLineInput,
  ParallelLineOutput,
  ParallelLineOutcome,
  ParallelLineTimeWindow,
} from "./parallel-line";

export type ActorId = string;
export type ItemId = string;
export type SceneObjectiveId = string;
export type SceneThreatId = string;
export type StoryArcId = string;
export type StoryBeatId = string;
export type MemoryFactId = string;
export type MajorEventMemoryId = string;
export type DailySummaryMemoryId = string;
export type RuleSetId =
  | "fate-worldview-filter"
  | "fate-rank-combat"
  | "jpy-2004-economy"
  | "custom";
export type TimelineId =
  | "fz"
  | "fsn"
  | "case-files"
  | "fsf"
  | "mahoyo"
  | "kara-no-kyoukai"
  | "tsukihime-2000"
  | "tsukihime-2021"
  | "custom";
export type OpeningMode = "random" | "selected" | "custom";
export type BoundaryKind = "normal" | "bounded-field" | "reality-marble" | "otherworld";
export type SituationKind =
  | "daily"
  | "investigation"
  | "social"
  | "combat"
  | "ritual"
  | "escape"
  | "downtime";
export type SceneObjectiveStatus = "active" | "blocked" | "resolved";
export type SceneThreatSeverity = "low" | "medium" | "high" | "lethal";
export type ActorKind = "human" | "outsider" | "spirit" | "other";
export type ActorStance = "self" | "ally" | "friendly" | "neutral" | "wary" | "hostile" | "unknown";
export type FateRankBase = "E" | "D" | "C" | "B" | "A" | "EX";
export type FateRank =
  | FateRankBase
  | `${FateRankBase}+`
  | `${FateRankBase}++`
  | `${FateRankBase}+++`
  | `${FateRankBase}-`;
export type Percent = number;
export type ServantClass =
  | "Saber"
  | "Archer"
  | "Lancer"
  | "Rider"
  | "Caster"
  | "Assassin"
  | "Berserker"
  | "Avenger"
  | "Ruler"
  | "AlterEgo"
  | "Foreigner"
  | "Shielder"
  | "MoonCancer"
  | "Pretender"
  | "Custom";
export type WoundSeverity = "minor" | "moderate" | "severe" | "critical";

export interface GameState {
  meta: StateMeta;
  public: PublicGameState;
  secrets: SecretGameState;
}

export interface StateMeta {
  schemaVersion: 1;
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
  timezone: "Asia/Tokyo";
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
  status: "normal" | "overheated" | "depleted" | "dormant" | "damaged";
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
  kind: "mundane" | "weapon" | "mystic-code" | "document" | "key-item" | "other";
  ownerActorId: ActorId | null;
  holderActorId: ActorId | null;
  location: LocationState | null;
  condition: "intact" | "damaged" | "broken" | "spent" | "unknown";
  visibility: "player-known" | "suspected";
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
  status: "hidden" | "suspected" | "revealed";
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
  masterActorId: ActorId;
  masterName: string;
  status: "stable" | "weak";
  manaSupply: "sufficient" | "strained" | "starved";
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

export interface NoblePhantasm {
  name: string;
  rank: FateRank | "none";
  kind: string;
  status: "hidden" | "suspected" | "revealed";
  summary: string;
}

export interface EconomyState {
  currency: "JPY";
  accessibleFunds: MoneyPurse[];
  debts: DebtState[];
}

export interface MoneyPurse {
  id: string;
  ownerActorId: ActorId;
  label: string;
  amount: number;
  access: "held" | "shared" | "requires-permission";
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
  scope: "protagonist" | "npc" | "faction" | "world";
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

export interface PatchOp {
  op: "replace";
  path: string;
  value: unknown;
}

export type StatePatchPath = never;

export const CURRENT_STATE_SCHEMA_VERSION = 1;

const SESSION_KEY = "fsn-state";
const DEBUG_STATE_PATH = "state/state.json";
const INITIAL_CURRENT_TIME = "2004-01-30T07:00:00.000Z";
const PROTAGONIST_ACTOR_ID = "protagonist";
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;

let nextIdCounter = 1;

const ALLOWED_PATCH_PATHS: readonly StatePatchPath[] = [];

declare global {
  // eslint-disable-next-line no-var -- jiti/tsx may instantiate modules more than once; global store keeps one runtime state.
  var __fsn_state_store__: State | undefined;
}

export function getState(): State {
  return cloneState();
}

export function getPublicState(): PublicGameState {
  return structuredClone(getStore().public);
}

export function cloneState(): State {
  return structuredClone(getStore());
}

export function exportState(): StateExport {
  return toStateExport(getStore());
}

export function patchState(ops: ReadonlyArray<PatchOp>): State {
  if (ops.length > 0) {
    throw new Error(
      "patch_state 已降级为 debug-only 且不再接受裸 JSON Patch；请使用领域 update 工具。",
    );
  }
  return cloneState();
}

export function replaceStateForDebug(state: State): State {
  const validated = assertState(state);
  setStore(touchState(validated));
  return cloneState();
}

export function updateState(mutator: (draft: State) => void): State {
  const next = cloneState();
  mutator(next);
  setStore(touchState(assertState(next)));
  return cloneState();
}

export function transactState<T>(operation: () => T): T {
  const before = cloneState();
  try {
    return operation();
  } catch (error) {
    setStore(before);
    throw error;
  }
}

export function resetState(): State {
  const fresh = createInitialState();
  setStore(fresh);
  return structuredClone(fresh);
}

export function hydrateState(raw: unknown): void {
  const state = assertState(raw);
  setStore(state);
}

export function toSessionEntry(state: State): Record<string, unknown> {
  return { v: CURRENT_STATE_SCHEMA_VERSION, turn: 0, state: structuredClone(state) };
}

export function sessionKey(): string {
  return SESSION_KEY;
}

export function writeStateToDetails(details: Record<string, unknown>): void {
  details[SESSION_KEY] = toSessionEntry(getStore());
}

export function allowedPatchPaths(): readonly StatePatchPath[] {
  return ALLOWED_PATCH_PATHS;
}

export function writeDebugStateFile(): string {
  writeStateDebugSnapshot(getStore());
  return DEBUG_STATE_PATH;
}

export function createId(prefix: string): string {
  const idPrefix = assertNonEmptyString(prefix, "idPrefix");
  const next = Math.max(nextIdCounter, highestExistingIdNumber(idPrefix) + 1);
  nextIdCounter = next + 1;
  return `${idPrefix}-${next}`;
}

export function assertPercent(value: unknown, fieldName: string): Percent {
  const percent = assertInteger(value, fieldName);
  if (percent < MIN_PERCENT || percent > MAX_PERCENT) {
    throw new Error(`非法${fieldName}: ${percent}。必须在 0-100 之间。`);
  }
  return percent;
}

export function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是字符串。`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`非法${fieldName}: 不能为空。`);
  }
  return trimmed;
}

export function assertOptionalString(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }
  return assertNonEmptyString(value, fieldName);
}

export function assertIsoDateString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是 ISO 时间字符串。`);
  }
  return normalizeIsoInstant(value, fieldName);
}

export function assertNonNegativeInteger(value: unknown, fieldName: string): number {
  const integer = assertInteger(value, fieldName);
  if (integer < 0) {
    throw new Error(`非法${fieldName}: ${integer}。不能为负数。`);
  }
  return integer;
}

function getStore(): State {
  if (!globalThis.__fsn_state_store__) {
    globalThis.__fsn_state_store__ = createInitialState();
  }
  return globalThis.__fsn_state_store__;
}

function setStore(state: State): void {
  globalThis.__fsn_state_store__ = structuredClone(state);
  writeStateDebugSnapshot(state);
}

function writeStateDebugSnapshot(state: State): void {
  mkdirSync("state", { recursive: true });
  writeFileSync(DEBUG_STATE_PATH, `${JSON.stringify(toStateExport(state), null, 2)}\n`, "utf-8");
}

function toStateExport(state: State): StateExport {
  const snapshot = structuredClone(state);
  const humanTime = formatHumanTime(snapshot.public.clock.currentAt);
  return {
    ...snapshot,
    public: {
      ...snapshot.public,
      clock: {
        ...snapshot.public.clock,
        displayTime: humanTime.display,
        date: humanTime.date,
        weekday: humanTime.weekday,
        time: humanTime.time,
      },
    },
  };
}

function highestExistingIdNumber(prefix: string): number {
  const marker = `${prefix}-`;
  let highest = 0;
  for (const id of collectIds(getStore())) {
    if (!id.startsWith(marker)) continue;
    const suffix = id.slice(marker.length);
    if (!/^\d+$/.test(suffix)) continue;
    highest = Math.max(highest, Number(suffix));
  }
  return highest;
}

function collectIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectIds(entry));
  }
  if (!isRecord(value)) {
    return [];
  }
  const ids: string[] = [];
  const id = value["id"];
  if (typeof id === "string") {
    ids.push(id);
  }
  for (const entry of Object.values(value)) {
    ids.push(...collectIds(entry));
  }
  return ids;
}

function createInitialState(): State {
  const now = nowIso();
  const protagonist = createInitialProtagonist();
  return {
    meta: {
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    },
    public: {
      campaign: {
        title: "Fate 沙盒",
        timeline: "fsn",
        openingMode: "selected",
        premise: "2004 年冬木，玩家角色的身份与卷入方式尚待开局确认。",
        activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "jpy-2004-economy"],
      },
      clock: {
        startedAt: INITIAL_CURRENT_TIME,
        currentAt: INITIAL_CURRENT_TIME,
        timezone: "Asia/Tokyo",
        lastLongRestAt: null,
      },
      scene: {
        location: {
          region: "冬木市",
          site: "深山镇",
          detail: "穗群原学园·校门外",
          boundary: "normal",
        },
        situation: "daily",
        storyWindow: null,
        presentActorIds: [PROTAGONIST_ACTOR_ID],
        objectives: [],
        threats: [],
        lastResolvedAt: INITIAL_CURRENT_TIME,
      },
      actors: { [PROTAGONIST_ACTOR_ID]: protagonist },
      trackedItems: {},
      protagonistActorId: PROTAGONIST_ACTOR_ID,
      allyActorIds: [],
      economy: {
        currency: "JPY",
        accessibleFunds: [
          {
            id: "purse-protagonist-cash",
            ownerActorId: PROTAGONIST_ACTOR_ID,
            label: "随身现金",
            amount: 50000,
            access: "held",
          },
        ],
        debts: [],
      },
      memory: {
        pinnedFacts: [
          {
            id: "fact-opening-identity-unfixed",
            scope: "protagonist",
            subject: PROTAGONIST_ACTOR_ID,
            text: "玩家角色身份尚未锁定；不得默认是御主、普通人或从者。",
            since: INITIAL_CURRENT_TIME,
            sourceEventId: null,
          },
        ],
        eventLog: [],
        dailySummaries: [],
      },
    },
    secrets: {
      actorSecrets: {},
      campaignSecrets: [],
      secretEventLog: [],
      offscreenEventLog: [],
    },
  };
}

function createInitialProtagonist(): HumanActorState {
  return {
    id: PROTAGONIST_ACTOR_ID,
    kind: "human",
    roles: [],
    magecraft: null,
    servantForm: null,
    identity: {
      publicIdentity: "身份未定的玩家角色",
      background: "开局尚未确认。由初始化或后续记忆事件锁定，不得在叙事中漂移。",
      lockedFacts: [],
    },
    presentation: {
      displayName: "你",
      apparentAge: "未确认",
      outfit: { label: "日常服装", details: "开局尚未细化。" },
      demeanor: "由玩家行动定义。",
    },
    condition: { wounds: [], afflictions: [], permanentEffects: [] },
    inventory: { ordinaryItems: [], heldTrackedItemIds: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "self", summary: "玩家本人。" },
  };
}

function assertState(raw: unknown): State {
  if (!isRecord(raw)) {
    throw new Error(`非法状态: ${formatUnknown(raw)}。状态必须是对象。`);
  }
  const stateRaw = isRecord(raw["state"]) ? raw["state"] : raw;
  if (!isRecord(stateRaw)) {
    throw new Error(`非法状态: ${formatUnknown(raw)}。state 必须是对象。`);
  }
  return assertGameStateV1(stateRaw);
}

function assertGameStateV1(raw: Record<string, unknown>): State {
  const meta = assertMeta(raw["meta"]);
  const publicState = assertPublicGameState(raw["public"]);
  const secrets = assertSecretGameState(raw["secrets"]);
  return { meta, public: publicState, secrets };
}

function assertMeta(raw: unknown): StateMeta {
  if (!isRecord(raw)) {
    throw new Error(`非法 meta: ${formatUnknown(raw)}。`);
  }
  return {
    schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
    createdAt: assertIsoDateString(raw["createdAt"], "meta.createdAt"),
    updatedAt: assertIsoDateString(raw["updatedAt"], "meta.updatedAt"),
  };
}

function assertPublicGameState(raw: unknown): PublicGameState {
  if (!isRecord(raw)) {
    throw new Error(`非法 public state: ${formatUnknown(raw)}。`);
  }
  const actors = assertActorRegistry(raw["actors"]);
  const protagonistActorId = assertExistingActorId(
    raw["protagonistActorId"],
    actors,
    "protagonistActorId",
  );
  const allyActorIds = assertStringArray(raw["allyActorIds"], "allyActorIds");
  for (const actorId of allyActorIds) {
    assertExistingActorId(actorId, actors, "allyActorIds[]");
  }
  return {
    campaign: assertCampaignState(raw["campaign"]),
    clock: assertClockState(raw["clock"]),
    scene: assertSceneState(raw["scene"], actors),
    actors,
    trackedItems: assertTrackedItems(raw["trackedItems"], actors),
    protagonistActorId,
    allyActorIds,
    economy: assertEconomyState(raw["economy"], actors),
    memory: assertCampaignMemory(raw["memory"]),
  };
}

function assertCampaignState(raw: unknown): CampaignState {
  if (!isRecord(raw)) {
    throw new Error(`非法 campaign: ${formatUnknown(raw)}。`);
  }
  return {
    title: assertNonEmptyString(raw["title"], "campaign.title"),
    timeline: assertOneOf(raw["timeline"], TIMELINES, "campaign.timeline"),
    openingMode: assertOneOf(raw["openingMode"], OPENING_MODES, "campaign.openingMode"),
    premise: assertNonEmptyString(raw["premise"], "campaign.premise"),
    activeRuleSetIds: assertArray(raw["activeRuleSetIds"], "campaign.activeRuleSetIds").map(
      (value) => assertOneOf(value, RULE_SET_IDS, "campaign.activeRuleSetIds[]"),
    ),
  };
}

function assertClockState(raw: unknown): ClockState {
  if (!isRecord(raw)) {
    throw new Error(`非法 clock: ${formatUnknown(raw)}。`);
  }
  return {
    startedAt: assertIsoDateString(raw["startedAt"], "clock.startedAt"),
    currentAt: assertIsoDateString(raw["currentAt"], "clock.currentAt"),
    timezone: assertOneOf(raw["timezone"], ["Asia/Tokyo"] as const, "clock.timezone"),
    lastLongRestAt:
      raw["lastLongRestAt"] === null
        ? null
        : assertIsoDateString(raw["lastLongRestAt"], "clock.lastLongRestAt"),
  };
}

function assertSceneState(raw: unknown, actors: Record<ActorId, PublicActorState>): SceneState {
  if (!isRecord(raw)) {
    throw new Error(`非法 scene: ${formatUnknown(raw)}。`);
  }
  const presentActorIds = assertStringArray(raw["presentActorIds"], "scene.presentActorIds");
  for (const actorId of presentActorIds) {
    assertExistingActorId(actorId, actors, "scene.presentActorIds[]");
  }
  return {
    location: assertLocationState(raw["location"], "scene.location"),
    situation: assertOneOf(raw["situation"], SITUATIONS, "scene.situation"),
    storyWindow: raw["storyWindow"] === null ? null : assertStoryWindowState(raw["storyWindow"]),
    presentActorIds,
    objectives: assertArray(raw["objectives"], "scene.objectives").map(assertSceneObjective),
    threats: assertArray(raw["threats"], "scene.threats").map(assertSceneThreat),
    lastResolvedAt: assertIsoDateString(raw["lastResolvedAt"], "scene.lastResolvedAt"),
  };
}

function assertLocationState(raw: unknown, fieldName: string): LocationState {
  if (!isRecord(raw)) {
    throw new Error(`非法${fieldName}: ${formatUnknown(raw)}。`);
  }
  return {
    region: assertNonEmptyString(raw["region"], `${fieldName}.region`),
    site: assertNonEmptyString(raw["site"], `${fieldName}.site`),
    detail: assertNonEmptyString(raw["detail"], `${fieldName}.detail`),
    boundary: assertOneOf(raw["boundary"], BOUNDARIES, `${fieldName}.boundary`),
  };
}

function assertStoryWindowState(raw: unknown): StoryWindowState {
  if (!isRecord(raw)) {
    throw new Error(`非法 story window: ${formatUnknown(raw)}。`);
  }
  return {
    currentArcId: assertNonEmptyString(raw["currentArcId"], "storyWindow.currentArcId"),
    currentBeatId: assertNonEmptyString(raw["currentBeatId"], "storyWindow.currentBeatId"),
    title: assertNonEmptyString(raw["title"], "storyWindow.title"),
    allowedActions: assertStringArray(raw["allowedActions"], "storyWindow.allowedActions"),
    forbiddenEscalations: assertStringArray(
      raw["forbiddenEscalations"],
      "storyWindow.forbiddenEscalations",
    ),
    completionCriteria: assertStringArray(
      raw["completionCriteria"],
      "storyWindow.completionCriteria",
    ),
    nextBeatHints: assertStringArray(raw["nextBeatHints"], "storyWindow.nextBeatHints"),
  };
}

function assertSceneObjective(raw: unknown): SceneObjective {
  if (!isRecord(raw)) {
    throw new Error(`非法 scene objective: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "objective.id"),
    summary: assertNonEmptyString(raw["summary"], "objective.summary"),
    status: assertOneOf(raw["status"], OBJECTIVE_STATUSES, "objective.status"),
  };
}

function assertSceneThreat(raw: unknown): SceneThreat {
  if (!isRecord(raw)) {
    throw new Error(`非法 scene threat: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "threat.id"),
    summary: assertNonEmptyString(raw["summary"], "threat.summary"),
    severity: assertOneOf(raw["severity"], THREAT_SEVERITIES, "threat.severity"),
  };
}

function assertActorRegistry(raw: unknown): Record<ActorId, PublicActorState> {
  if (!isRecord(raw)) {
    throw new Error(`非法 actors: ${formatUnknown(raw)}。`);
  }
  const actors: Record<ActorId, PublicActorState> = {};
  for (const [actorId, actorRaw] of Object.entries(raw)) {
    const actor = assertPublicActorState(actorRaw);
    if (actor.id !== actorId) {
      throw new Error(`actor registry key ${actorId} 与 actor.id ${actor.id} 不一致。`);
    }
    actors[actorId] = actor;
  }
  return actors;
}

function assertPublicActorState(raw: unknown): PublicActorState {
  if (!isRecord(raw)) {
    throw new Error(`非法 actor: ${formatUnknown(raw)}。`);
  }
  switch (assertOneOf(raw["kind"], ACTOR_KINDS, "actor.kind")) {
    case "human":
      return assertHumanActorState(raw);
    case "outsider":
      return {
        ...assertActorBase(raw, "outsider"),
        sourceProfile: assertNonEmptyString(raw["sourceProfile"], "actor.sourceProfile"),
        fateTranslation: assertNonEmptyString(raw["fateTranslation"], "actor.fateTranslation"),
        restrictions: assertStringArray(raw["restrictions"], "actor.restrictions"),
      };
    case "spirit":
      return {
        ...assertActorBase(raw, "spirit"),
        origin: assertNonEmptyString(raw["origin"], "actor.origin"),
      };
    case "other":
      return {
        ...assertActorBase(raw, "other"),
        nature: assertNonEmptyString(raw["nature"], "actor.nature"),
      };
    default:
      throw new Error("unreachable actor kind");
  }
}

function assertHumanActorState(raw: Record<string, unknown>): HumanActorState {
  return assertActorBase(raw, "human");
}

function assertActorBase<TKind extends ActorKind>(
  raw: Record<string, unknown>,
  kind: TKind,
): ActorBase & { kind: TKind } {
  return {
    id: assertNonEmptyString(raw["id"], "actor.id"),
    kind,
    roles: assertArray(raw["roles"], "actor.roles").map(assertActorRole),
    magecraft: raw["magecraft"] === null ? null : assertMagecraftCapability(raw["magecraft"]),
    servantForm: raw["servantForm"] === null ? null : assertServantCoreState(raw["servantForm"]),
    identity: assertIdentityState(raw["identity"]),
    presentation: assertPresentationState(raw["presentation"]),
    condition: assertConditionState(raw["condition"]),
    inventory: assertInventoryState(raw["inventory"]),
    abilities: assertArray(raw["abilities"], "actor.abilities").map(assertAbilityState),
    relationshipToProtagonist: assertRelationshipState(raw["relationshipToProtagonist"]),
  };
}

function assertActorRole(raw: unknown): ActorRole {
  if (!isRecord(raw)) {
    throw new Error(`非法 actor role: ${formatUnknown(raw)}。`);
  }
  const kind = assertOneOf(raw["kind"], ROLE_KINDS, "role.kind");
  switch (kind) {
    case "master":
      return {
        kind,
        commandSpells: assertCommandSpellState(raw["commandSpells"]),
        contractedServantIds: assertStringArray(
          raw["contractedServantIds"],
          "role.contractedServantIds",
        ),
      };
    case "social":
      return { kind, label: assertNonEmptyString(raw["label"], "role.label") };
    case "faction":
      return {
        kind,
        factionId: assertNonEmptyString(raw["factionId"], "role.factionId"),
        label: assertNonEmptyString(raw["label"], "role.label"),
      };
    default:
      throw new Error("unreachable role kind");
  }
}

function assertCommandSpellState(raw: unknown): CommandSpellState {
  if (!isRecord(raw)) {
    throw new Error(`非法 commandSpells: ${formatUnknown(raw)}。`);
  }
  const total = assertNonNegativeInteger(raw["total"], "commandSpells.total");
  const remaining = assertNonNegativeInteger(raw["remaining"], "commandSpells.remaining");
  if (remaining > total) {
    throw new Error("非法 commandSpells: remaining 不能大于 total。");
  }
  return { total, remaining };
}

function assertMagecraftCapability(raw: unknown): MagecraftCapability {
  if (!isRecord(raw)) {
    throw new Error(`非法 magecraft: ${formatUnknown(raw)}。`);
  }
  return {
    circuits: assertMagecraftCircuitState(raw["circuits"]),
    disciplines: assertArray(raw["disciplines"], "magecraft.disciplines").map(
      assertMagecraftDiscipline,
    ),
    affiliation:
      raw["affiliation"] === null
        ? null
        : assertNonEmptyString(raw["affiliation"], "magecraft.affiliation"),
  };
}

function assertMagecraftCircuitState(raw: unknown): MagecraftCircuitState {
  if (!isRecord(raw)) {
    throw new Error(`非法 circuits: ${formatUnknown(raw)}。`);
  }
  return {
    count: assertNonEmptyString(raw["count"], "circuits.count"),
    quality:
      raw["quality"] === "none"
        ? "none"
        : assertOneOf(raw["quality"], FATE_RANKS, "circuits.quality"),
    od: assertPercent(raw["od"], "circuits.od"),
    status: assertOneOf(raw["status"], CIRCUIT_STATUSES, "circuits.status"),
    traits: assertStringArray(raw["traits"], "circuits.traits"),
  };
}

function assertMagecraftDiscipline(raw: unknown): MagecraftDiscipline {
  if (!isRecord(raw)) {
    throw new Error(`非法 discipline: ${formatUnknown(raw)}。`);
  }
  return {
    name: assertNonEmptyString(raw["name"], "discipline.name"),
    rank: raw["rank"] === "none" ? "none" : assertOneOf(raw["rank"], FATE_RANKS, "discipline.rank"),
    notes: assertNonEmptyString(raw["notes"], "discipline.notes"),
  };
}

function assertIdentityState(raw: unknown): IdentityState {
  if (!isRecord(raw)) {
    throw new Error(`非法 identity: ${formatUnknown(raw)}。`);
  }
  return {
    publicIdentity: assertNonEmptyString(raw["publicIdentity"], "identity.publicIdentity"),
    background: assertNonEmptyString(raw["background"], "identity.background"),
    lockedFacts: assertArray(raw["lockedFacts"], "identity.lockedFacts").map(assertLockedFact),
  };
}

function assertLockedFact(raw: unknown): LockedFact {
  if (!isRecord(raw)) {
    throw new Error(`非法 locked fact: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "lockedFact.id"),
    text: assertNonEmptyString(raw["text"], "lockedFact.text"),
  };
}

function assertPresentationState(raw: unknown): PresentationState {
  if (!isRecord(raw)) {
    throw new Error(`非法 presentation: ${formatUnknown(raw)}。`);
  }
  return {
    displayName: assertNonEmptyString(raw["displayName"], "presentation.displayName"),
    apparentAge: assertNonEmptyString(raw["apparentAge"], "presentation.apparentAge"),
    outfit: assertOutfitState(raw["outfit"]),
    demeanor: assertNonEmptyString(raw["demeanor"], "presentation.demeanor"),
  };
}

function assertOutfitState(raw: unknown): OutfitState {
  if (!isRecord(raw)) {
    throw new Error(`非法 outfit: ${formatUnknown(raw)}。`);
  }
  return {
    label: assertNonEmptyString(raw["label"], "outfit.label"),
    details: assertNonEmptyString(raw["details"], "outfit.details"),
  };
}

function assertRelationshipState(raw: unknown): RelationshipState {
  if (!isRecord(raw)) {
    throw new Error(`非法 relationship: ${formatUnknown(raw)}。`);
  }
  return {
    stance: assertOneOf(raw["stance"], STANCES, "relationship.stance"),
    summary: assertNonEmptyString(raw["summary"], "relationship.summary"),
  };
}

function assertConditionState(raw: unknown): ConditionState {
  if (!isRecord(raw)) {
    throw new Error(`非法 condition: ${formatUnknown(raw)}。`);
  }
  return {
    wounds: assertArray(raw["wounds"], "condition.wounds").map(assertWoundState),
    afflictions: assertArray(raw["afflictions"], "condition.afflictions").map(
      assertAfflictionState,
    ),
    permanentEffects: assertArray(raw["permanentEffects"], "condition.permanentEffects").map(
      assertPermanentEffect,
    ),
  };
}

function assertWoundState(raw: unknown): WoundState {
  if (!isRecord(raw)) {
    throw new Error(`非法 wound: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "wound.id"),
    severity: assertOneOf(raw["severity"], WOUND_SEVERITIES, "wound.severity"),
    text: assertNonEmptyString(raw["text"], "wound.text"),
    recoverable: assertBoolean(raw["recoverable"], "wound.recoverable"),
    treatment:
      raw["treatment"] === null ? null : assertNonEmptyString(raw["treatment"], "wound.treatment"),
  };
}

function assertAfflictionState(raw: unknown): AfflictionState {
  if (!isRecord(raw)) {
    throw new Error(`非法 affliction: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "affliction.id"),
    source: assertNonEmptyString(raw["source"], "affliction.source"),
    text: assertNonEmptyString(raw["text"], "affliction.text"),
    expectedDuration:
      raw["expectedDuration"] === null
        ? null
        : assertNonEmptyString(raw["expectedDuration"], "affliction.expectedDuration"),
  };
}

function assertPermanentEffect(raw: unknown): PermanentEffect {
  if (!isRecord(raw)) {
    throw new Error(`非法 permanent effect: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "permanentEffect.id"),
    source: assertNonEmptyString(raw["source"], "permanentEffect.source"),
    text: assertNonEmptyString(raw["text"], "permanentEffect.text"),
    mechanicalEffect: assertNonEmptyString(
      raw["mechanicalEffect"],
      "permanentEffect.mechanicalEffect",
    ),
  };
}

function assertPermanentDefect(raw: unknown): PermanentDefect {
  if (!isRecord(raw)) {
    throw new Error(`非法 permanent defect: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "permanentDefect.id"),
    source: assertNonEmptyString(raw["source"], "permanentDefect.source"),
    text: assertNonEmptyString(raw["text"], "permanentDefect.text"),
    mechanicalEffect: assertNonEmptyString(
      raw["mechanicalEffect"],
      "permanentDefect.mechanicalEffect",
    ),
  };
}

function assertInventoryState(raw: unknown): InventoryState {
  if (!isRecord(raw)) {
    throw new Error(`非法 inventory: ${formatUnknown(raw)}。`);
  }
  return {
    ordinaryItems: assertStringArray(raw["ordinaryItems"], "inventory.ordinaryItems"),
    heldTrackedItemIds: assertStringArray(
      raw["heldTrackedItemIds"],
      "inventory.heldTrackedItemIds",
    ),
  };
}

function assertAbilityState(raw: unknown): AbilityState {
  if (!isRecord(raw)) {
    throw new Error(`非法 ability: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "ability.id"),
    label: assertNonEmptyString(raw["label"], "ability.label"),
    summary: assertNonEmptyString(raw["summary"], "ability.summary"),
  };
}

function assertTrackedItems(
  raw: unknown,
  actors: Record<ActorId, PublicActorState>,
): Record<ItemId, TrackedItemState> {
  if (!isRecord(raw)) {
    throw new Error(`非法 trackedItems: ${formatUnknown(raw)}。`);
  }
  const items: Record<ItemId, TrackedItemState> = {};
  for (const [itemId, itemRaw] of Object.entries(raw)) {
    const item = assertTrackedItemState(itemRaw, actors);
    if (item.id !== itemId) {
      throw new Error(`trackedItems key ${itemId} 与 item.id ${item.id} 不一致。`);
    }
    items[itemId] = item;
  }
  return items;
}

function assertTrackedItemState(
  raw: unknown,
  actors: Record<ActorId, PublicActorState>,
): TrackedItemState {
  if (!isRecord(raw)) {
    throw new Error(`非法 tracked item: ${formatUnknown(raw)}。`);
  }
  const ownerActorId =
    raw["ownerActorId"] === null
      ? null
      : assertExistingActorId(raw["ownerActorId"], actors, "item.ownerActorId");
  const holderActorId =
    raw["holderActorId"] === null
      ? null
      : assertExistingActorId(raw["holderActorId"], actors, "item.holderActorId");
  return {
    id: assertNonEmptyString(raw["id"], "item.id"),
    label: assertNonEmptyString(raw["label"], "item.label"),
    kind: assertOneOf(raw["kind"], ITEM_KINDS, "item.kind"),
    ownerActorId,
    holderActorId,
    location:
      raw["location"] === null ? null : assertLocationState(raw["location"], "item.location"),
    condition: assertOneOf(raw["condition"], ITEM_CONDITIONS, "item.condition"),
    visibility: assertOneOf(raw["visibility"], ITEM_VISIBILITIES, "item.visibility"),
    notes: assertStringArray(raw["notes"], "item.notes"),
  };
}

function assertServantCoreState(raw: unknown): ServantCoreState {
  if (!isRecord(raw)) {
    throw new Error(`非法 servantForm: ${formatUnknown(raw)}。`);
  }
  return {
    identity: assertServantIdentityState(raw["identity"]),
    condition: assertServantConditionState(raw["condition"]),
    contract: assertServantContractState(raw["contract"]),
    parameters: assertServantParameterState(raw["parameters"]),
    skills: assertServantSkillState(raw["skills"]),
    noblePhantasms: assertArray(raw["noblePhantasms"], "servant.noblePhantasms").map(
      assertNoblePhantasm,
    ),
    currentOrder: assertNonEmptyString(raw["currentOrder"], "servant.currentOrder"),
  };
}

function assertServantIdentityState(raw: unknown): ServantIdentityState {
  if (!isRecord(raw)) {
    throw new Error(`非法 servant identity: ${formatUnknown(raw)}。`);
  }
  if (raw["locked"] !== true) {
    throw new Error("非法 servant identity: locked 必须为 true。");
  }
  return {
    className: assertOneOf(raw["className"], SERVANT_CLASSES, "servant.className"),
    trueName: assertTrueNameState(raw["trueName"]),
    locked: true,
  };
}

function assertTrueNameState(raw: unknown): TrueNameState {
  if (!isRecord(raw)) {
    throw new Error(`非法 trueName: ${formatUnknown(raw)}。`);
  }
  return {
    status: assertOneOf(raw["status"], TRUE_NAME_STATUSES, "trueName.status"),
    display: assertNonEmptyString(raw["display"], "trueName.display"),
  };
}

function assertServantConditionState(raw: unknown): ServantConditionState {
  if (!isRecord(raw)) {
    throw new Error(`非法 servant condition: ${formatUnknown(raw)}。`);
  }
  return {
    spiritualCore: assertResourceTrack(raw["spiritualCore"], "spiritualCore"),
    mana: assertResourceTrack(raw["mana"], "mana"),
    spiritualCondition: assertNonEmptyString(raw["spiritualCondition"], "spiritualCondition"),
    permanentDefects: assertArray(raw["permanentDefects"], "permanentDefects").map(
      assertPermanentDefect,
    ),
  };
}

function assertResourceTrack(raw: unknown, fieldName: string): ResourceTrack {
  if (!isRecord(raw)) {
    throw new Error(`非法 ${fieldName}: ${formatUnknown(raw)}。`);
  }
  return { value: assertPercent(raw["value"], `${fieldName}.value`) };
}

function assertServantContractState(raw: unknown): ServantContractState {
  if (!isRecord(raw)) {
    throw new Error(`非法 contract: ${formatUnknown(raw)}。`);
  }
  return {
    masterActorId: assertNonEmptyString(raw["masterActorId"], "contract.masterActorId"),
    masterName: assertNonEmptyString(raw["masterName"], "contract.masterName"),
    status: assertOneOf(raw["status"], CONTRACT_STATUSES, "contract.status"),
    manaSupply: assertOneOf(raw["manaSupply"], MANA_SUPPLIES, "contract.manaSupply"),
  };
}

function assertServantParameterState(raw: unknown): ServantParameterState {
  if (!isRecord(raw)) {
    throw new Error(`非法 parameters: ${formatUnknown(raw)}。`);
  }
  if (raw["baseLocked"] !== true) {
    throw new Error("非法 servant parameters: baseLocked 必须为 true。");
  }
  return {
    base: assertFateParams(raw["base"]),
    modifiers: assertArray(raw["modifiers"], "parameters.modifiers").map(assertParamModifier),
    baseLocked: true,
  };
}

function assertFateParams(raw: unknown): FateParams {
  if (!isRecord(raw)) {
    throw new Error(`非法 Fate params: ${formatUnknown(raw)}。`);
  }
  return {
    strength: assertOneOf(raw["strength"], FATE_RANKS, "params.strength"),
    endurance: assertOneOf(raw["endurance"], FATE_RANKS, "params.endurance"),
    agility: assertOneOf(raw["agility"], FATE_RANKS, "params.agility"),
    mana: assertOneOf(raw["mana"], FATE_RANKS, "params.mana"),
    luck: assertOneOf(raw["luck"], FATE_RANKS, "params.luck"),
    noblePhantasm: assertOneOf(raw["noblePhantasm"], FATE_RANKS, "params.noblePhantasm"),
  };
}

function assertParamModifier(raw: unknown): ParamModifier {
  if (!isRecord(raw)) {
    throw new Error(`非法 param modifier: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "modifier.id"),
    source: assertNonEmptyString(raw["source"], "modifier.source"),
    affectedParams: assertArray(raw["affectedParams"], "modifier.affectedParams").map((value) =>
      assertOneOf(value, FATE_PARAM_KEYS, "modifier.affectedParams[]"),
    ),
    summary: assertNonEmptyString(raw["summary"], "modifier.summary"),
    expiresAt:
      raw["expiresAt"] === null
        ? null
        : assertIsoDateString(raw["expiresAt"], "modifier.expiresAt"),
  };
}

function assertServantSkillState(raw: unknown): ServantSkillState {
  if (!isRecord(raw)) {
    throw new Error(`非法 servant skills: ${formatUnknown(raw)}。`);
  }
  return {
    classSkills: assertArray(raw["classSkills"], "skills.classSkills").map(assertServantSkill),
    personalSkills: assertArray(raw["personalSkills"], "skills.personalSkills").map(
      assertServantSkill,
    ),
  };
}

function assertServantSkill(raw: unknown): ServantSkill {
  if (!isRecord(raw)) {
    throw new Error(`非法 servant skill: ${formatUnknown(raw)}。`);
  }
  return {
    name: assertNonEmptyString(raw["name"], "skill.name"),
    rank: raw["rank"] === "none" ? "none" : assertOneOf(raw["rank"], FATE_RANKS, "skill.rank"),
    summary: assertNonEmptyString(raw["summary"], "skill.summary"),
  };
}

function assertNoblePhantasm(raw: unknown): NoblePhantasm {
  if (!isRecord(raw)) {
    throw new Error(`非法 noble phantasm: ${formatUnknown(raw)}。`);
  }
  return {
    name: assertNonEmptyString(raw["name"], "noblePhantasm.name"),
    rank:
      raw["rank"] === "none" ? "none" : assertOneOf(raw["rank"], FATE_RANKS, "noblePhantasm.rank"),
    kind: assertNonEmptyString(raw["kind"], "noblePhantasm.kind"),
    status: assertOneOf(raw["status"], TRUE_NAME_STATUSES, "noblePhantasm.status"),
    summary: assertNonEmptyString(raw["summary"], "noblePhantasm.summary"),
  };
}

function assertEconomyState(raw: unknown, actors: Record<ActorId, PublicActorState>): EconomyState {
  if (!isRecord(raw)) {
    throw new Error(`非法 economy: ${formatUnknown(raw)}。`);
  }
  return {
    currency: assertOneOf(raw["currency"], ["JPY"] as const, "economy.currency"),
    accessibleFunds: assertArray(raw["accessibleFunds"], "economy.accessibleFunds").map((value) =>
      assertMoneyPurse(value, actors),
    ),
    debts: assertArray(raw["debts"], "economy.debts").map((value) =>
      assertDebtState(value, actors),
    ),
  };
}

function assertMoneyPurse(raw: unknown, actors: Record<ActorId, PublicActorState>): MoneyPurse {
  if (!isRecord(raw)) {
    throw new Error(`非法 money purse: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "purse.id"),
    ownerActorId: assertExistingActorId(raw["ownerActorId"], actors, "purse.ownerActorId"),
    label: assertNonEmptyString(raw["label"], "purse.label"),
    amount: assertNonNegativeInteger(raw["amount"], "purse.amount"),
    access: assertOneOf(raw["access"], PURSE_ACCESSES, "purse.access"),
  };
}

function assertDebtState(raw: unknown, actors: Record<ActorId, PublicActorState>): DebtState {
  if (!isRecord(raw)) {
    throw new Error(`非法 debt: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "debt.id"),
    debtorActorId: assertExistingActorId(raw["debtorActorId"], actors, "debt.debtorActorId"),
    creditor: assertNonEmptyString(raw["creditor"], "debt.creditor"),
    amount: assertNonNegativeInteger(raw["amount"], "debt.amount"),
    reason: assertNonEmptyString(raw["reason"], "debt.reason"),
  };
}

function assertCampaignMemory(raw: unknown): CampaignMemory {
  if (!isRecord(raw)) {
    throw new Error(`非法 memory: ${formatUnknown(raw)}。`);
  }
  return {
    pinnedFacts: assertArray(raw["pinnedFacts"], "memory.pinnedFacts").map(assertMemoryFact),
    eventLog: assertArray(raw["eventLog"], "memory.eventLog").map(assertMajorEventMemory),
    dailySummaries: assertArray(raw["dailySummaries"], "memory.dailySummaries").map(
      assertDailySummaryMemory,
    ),
  };
}

function assertMemoryFact(raw: unknown): MemoryFact {
  if (!isRecord(raw)) {
    throw new Error(`非法 memory fact: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "memoryFact.id"),
    scope: assertOneOf(raw["scope"], MEMORY_SCOPES, "memoryFact.scope"),
    subject: assertNonEmptyString(raw["subject"], "memoryFact.subject"),
    text: assertNonEmptyString(raw["text"], "memoryFact.text"),
    since: assertIsoDateString(raw["since"], "memoryFact.since"),
    sourceEventId:
      raw["sourceEventId"] === null
        ? null
        : assertNonEmptyString(raw["sourceEventId"], "memoryFact.sourceEventId"),
  };
}

function assertMajorEventMemory(raw: unknown): MajorEventMemory {
  if (!isRecord(raw)) {
    throw new Error(`非法 major event: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "majorEvent.id"),
    time: assertIsoDateString(raw["time"], "majorEvent.time"),
    title: assertNonEmptyString(raw["title"], "majorEvent.title"),
    summary: assertNonEmptyString(raw["summary"], "majorEvent.summary"),
    consequences: assertStringArray(raw["consequences"], "majorEvent.consequences"),
  };
}

function assertDailySummaryMemory(raw: unknown): DailySummaryMemory {
  if (!isRecord(raw)) {
    throw new Error(`非法 daily summary: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "dailySummary.id"),
    startDate: assertIsoDateString(raw["startDate"], "dailySummary.startDate"),
    endDate: assertIsoDateString(raw["endDate"], "dailySummary.endDate"),
    summary: assertNonEmptyString(raw["summary"], "dailySummary.summary"),
  };
}

function assertSecretGameState(raw: unknown): SecretGameState {
  if (!isRecord(raw)) {
    throw new Error(`非法 secrets: ${formatUnknown(raw)}。`);
  }
  return {
    actorSecrets: assertActorSecrets(raw["actorSecrets"]),
    campaignSecrets: assertArray(raw["campaignSecrets"], "secrets.campaignSecrets").map(
      assertSecretCampaignFact,
    ),
    secretEventLog: assertArray(raw["secretEventLog"], "secrets.secretEventLog").map(
      assertSecretEventMemory,
    ),
    offscreenEventLog:
      raw["offscreenEventLog"] === undefined
        ? []
        : assertArray(raw["offscreenEventLog"], "secrets.offscreenEventLog").map(
            assertOffscreenEvent,
          ),
  };
}

function assertActorSecrets(raw: unknown): Record<ActorId, ActorSecretSlots> {
  if (!isRecord(raw)) {
    throw new Error(`非法 actorSecrets: ${formatUnknown(raw)}。`);
  }
  const actorSecrets: Record<ActorId, ActorSecretSlots> = {};
  for (const [actorId, secretRaw] of Object.entries(raw)) {
    const slots = assertActorSecretSlots(secretRaw);
    if (slots.actorId !== actorId) {
      throw new Error(`actorSecrets key ${actorId} 与 actorId ${slots.actorId} 不一致。`);
    }
    actorSecrets[actorId] = slots;
  }
  return actorSecrets;
}

function assertActorSecretSlots(raw: unknown): ActorSecretSlots {
  if (!isRecord(raw)) {
    throw new Error(`非法 actor secret slots: ${formatUnknown(raw)}。`);
  }
  return {
    actorId: assertNonEmptyString(raw["actorId"], "actorSecret.actorId"),
    trueName:
      raw["trueName"] === undefined
        ? undefined
        : assertSecretSlot(raw["trueName"], assertNonEmptyStringValue),
    hiddenNoblePhantasms: assertArray(
      raw["hiddenNoblePhantasms"],
      "actorSecret.hiddenNoblePhantasms",
    ).map((value) => assertSecretSlot(value, assertNoblePhantasm)),
    privateMotives: assertArray(raw["privateMotives"], "actorSecret.privateMotives").map((value) =>
      assertSecretSlot(value, assertNonEmptyStringValue),
    ),
    unrevealedAffiliations: assertArray(
      raw["unrevealedAffiliations"],
      "actorSecret.unrevealedAffiliations",
    ).map((value) => assertSecretSlot(value, assertNonEmptyStringValue)),
  };
}

function assertSecretSlot<T>(raw: unknown, assertValue: (value: unknown) => T): SecretSlot<T> {
  if (!isRecord(raw)) {
    throw new Error(`非法 secret slot: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "secret.id"),
    value: assertValue(raw["value"]),
    revealState: assertOneOf(raw["revealState"], SECRET_REVEAL_STATES, "secret.revealState"),
    revealConditions: assertStringArray(raw["revealConditions"], "secret.revealConditions"),
  };
}

function assertSecretCampaignFact(raw: unknown): SecretCampaignFact {
  if (!isRecord(raw)) {
    throw new Error(`非法 secret campaign fact: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "secretCampaignFact.id"),
    text: assertNonEmptyString(raw["text"], "secretCampaignFact.text"),
    relatedActorIds: assertStringArray(
      raw["relatedActorIds"],
      "secretCampaignFact.relatedActorIds",
    ),
    revealState: assertOneOf(
      raw["revealState"],
      SECRET_REVEAL_STATES,
      "secretCampaignFact.revealState",
    ),
  };
}

function assertSecretEventMemory(raw: unknown): SecretEventMemory {
  if (!isRecord(raw)) {
    throw new Error(`非法 secret event: ${formatUnknown(raw)}。`);
  }
  return {
    id: assertNonEmptyString(raw["id"], "secretEvent.id"),
    time: assertIsoDateString(raw["time"], "secretEvent.time"),
    summary: assertNonEmptyString(raw["summary"], "secretEvent.summary"),
    relatedActorIds: assertStringArray(raw["relatedActorIds"], "secretEvent.relatedActorIds"),
  };
}

function assertOffscreenEvent(raw: unknown): OffscreenEvent {
  if (!isRecord(raw)) {
    throw new Error(`非法 offscreen event: ${formatUnknown(raw)}。`);
  }
  const timeRange = assertOffscreenEventTimeRange(raw["timeRange"]);
  return {
    id: assertNonEmptyString(raw["id"], "offscreenEvent.id"),
    lineId: assertNonEmptyString(raw["lineId"], "offscreenEvent.lineId"),
    actorIds: assertStringArray(raw["actorIds"], "offscreenEvent.actorIds"),
    timeRange,
    visibility: assertOneOf(
      raw["visibility"],
      OFFSCREEN_EVENT_VISIBILITIES,
      "offscreenEvent.visibility",
    ),
    summary: assertNonEmptyString(raw["summary"], "offscreenEvent.summary"),
    consequences: assertStringArray(raw["consequences"], "offscreenEvent.consequences"),
    futureHooks: assertStringArray(raw["futureHooks"], "offscreenEvent.futureHooks"),
    createdFrom: assertOneOf(
      raw["createdFrom"],
      OFFSCREEN_EVENT_SOURCES,
      "offscreenEvent.createdFrom",
    ),
  };
}

function assertOffscreenEventTimeRange(raw: unknown): OffscreenEvent["timeRange"] {
  if (!isRecord(raw)) {
    throw new Error(`非法 offscreenEvent.timeRange: ${formatUnknown(raw)}。`);
  }
  return {
    start: assertIsoDateString(raw["start"], "offscreenEvent.timeRange.start"),
    end: assertIsoDateString(raw["end"], "offscreenEvent.timeRange.end"),
  };
}

function touchState(state: State): State {
  return { ...state, meta: { ...state.meta, updatedAt: nowIso() } };
}

function assertExistingActorId(
  value: unknown,
  actors: Record<ActorId, PublicActorState>,
  fieldName: string,
): ActorId {
  const actorId = assertNonEmptyString(value, fieldName);
  if (actors[actorId] === undefined) {
    throw new Error(`非法${fieldName}: actor ${actorId} 不存在。`);
  }
  return actorId;
}

function assertNonEmptyStringValue(value: unknown): string {
  return assertNonEmptyString(value, "secret.value");
}

function assertStringArray(value: unknown, fieldName: string): string[] {
  return assertArray(value, fieldName).map((entry) =>
    assertNonEmptyString(entry, `${fieldName}[]`),
  );
}

function assertArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是数组。`);
  }
  return value;
}

function assertBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是 boolean。`);
  }
  return value;
}

function assertInteger(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是整数。`);
}

function assertOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fieldName: string,
): T[number] {
  if (typeof value !== "string") {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是字符串。`);
  }
  if (!allowed.includes(value)) {
    throw new Error(`非法${fieldName}: ${value}。允许值: ${allowed.join(", ")}。`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return `无法序列化的值 (${String(error)})`;
  }
}

function addMinutes(iso: string, minutes: number): string {
  const instant = Temporal.Instant.from(iso);
  return instant.add({ minutes }).toString();
}

export function advanceClock(minutes: number, reason: string): State {
  if (reason.trim().length === 0) {
    throw new Error("advanceClock 必须提供 reason。");
  }
  const elapsedMinutes = assertNonNegativeInteger(minutes, "elapsedMinutes");
  return updateState((draft) => {
    const nextTime = addMinutes(draft.public.clock.currentAt, elapsedMinutes);
    draft.public.clock.currentAt = nextTime;
    draft.public.scene.lastResolvedAt = nextTime;
  });
}

const RULE_SET_IDS = [
  "fate-worldview-filter",
  "fate-rank-combat",
  "jpy-2004-economy",
  "custom",
] as const;
const TIMELINES = [
  "fz",
  "fsn",
  "case-files",
  "fsf",
  "mahoyo",
  "kara-no-kyoukai",
  "tsukihime-2000",
  "tsukihime-2021",
  "custom",
] as const;
const OPENING_MODES = ["random", "selected", "custom"] as const;
const BOUNDARIES = ["normal", "bounded-field", "reality-marble", "otherworld"] as const;
const SITUATIONS = [
  "daily",
  "investigation",
  "social",
  "combat",
  "ritual",
  "escape",
  "downtime",
] as const;
const OBJECTIVE_STATUSES = ["active", "blocked", "resolved"] as const;
const THREAT_SEVERITIES = ["low", "medium", "high", "lethal"] as const;
const ACTOR_KINDS = ["human", "outsider", "spirit", "other"] as const;
const ROLE_KINDS = ["master", "social", "faction"] as const;
const STANCES = ["self", "ally", "friendly", "neutral", "wary", "hostile", "unknown"] as const;
const FATE_RANKS = [
  "E",
  "E+",
  "E++",
  "E+++",
  "E-",
  "D",
  "D+",
  "D++",
  "D+++",
  "D-",
  "C",
  "C+",
  "C++",
  "C+++",
  "C-",
  "B",
  "B+",
  "B++",
  "B+++",
  "B-",
  "A",
  "A+",
  "A++",
  "A+++",
  "A-",
  "EX",
  "EX+",
  "EX++",
  "EX+++",
  "EX-",
] as const;
const CIRCUIT_STATUSES = ["normal", "overheated", "depleted", "dormant", "damaged"] as const;
const WOUND_SEVERITIES = ["minor", "moderate", "severe", "critical"] as const;
const ITEM_KINDS = ["mundane", "weapon", "mystic-code", "document", "key-item", "other"] as const;
const ITEM_CONDITIONS = ["intact", "damaged", "broken", "spent", "unknown"] as const;
const ITEM_VISIBILITIES = ["player-known", "suspected"] as const;
const SERVANT_CLASSES = [
  "Saber",
  "Archer",
  "Lancer",
  "Rider",
  "Caster",
  "Assassin",
  "Berserker",
  "Avenger",
  "Ruler",
  "AlterEgo",
  "Foreigner",
  "Shielder",
  "MoonCancer",
  "Pretender",
  "Custom",
] as const;
const TRUE_NAME_STATUSES = ["hidden", "suspected", "revealed"] as const;
const CONTRACT_STATUSES = ["stable", "weak"] as const;
const MANA_SUPPLIES = ["sufficient", "strained", "starved"] as const;
const FATE_PARAM_KEYS = [
  "strength",
  "endurance",
  "agility",
  "mana",
  "luck",
  "noblePhantasm",
] as const;
const PURSE_ACCESSES = ["held", "shared", "requires-permission"] as const;
const MEMORY_SCOPES = ["protagonist", "npc", "faction", "world"] as const;
const SECRET_REVEAL_STATES = ["hidden", "foreshadowed", "revealed"] as const;
const OFFSCREEN_EVENT_VISIBILITIES = ["secret", "foreshadowed", "player-known"] as const;
const OFFSCREEN_EVENT_SOURCES = ["parallel-line-subagent", "gm", "debug"] as const;
