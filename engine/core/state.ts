import type { NoblePhantasm } from "./actor-schema";
import type { OffscreenEvent } from "./parallel-line";
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
} from "./state-enum-schemas";

export type { NoblePhantasm } from "./actor-schema";

import { Temporal } from "@js-temporal/polyfill";
import { mkdirSync, writeFileSync } from "node:fs";

import { formatHumanTime, normalizeIsoInstant, nowIso } from "./date-time";
import { parseStateSchema } from "./state-schema";

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
} from "./state-enum-schemas";

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

export interface PatchOp {
  op: "replace";
  path: string;
  value: unknown;
}

export type StatePatchPath = never;

export const CURRENT_STATE_SCHEMA_VERSION = 3;

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

export function migrateState(raw: unknown): State {
  return assertState(raw);
}

export function appendTurnLogEntry(input: Omit<TurnLogEntry, "id">): TurnLogEntry {
  let entry: TurnLogEntry;
  updateState((draft) => {
    entry = {
      id: nextTurnLogId(draft.public.turnLog),
      ...input,
    };
    draft.public.turnLog.push(entry);
  });
  return entry!;
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
  const normalizedState = pruneExpiredParamModifiers(structuredClone(state));
  globalThis.__fsn_state_store__ = normalizedState;
  writeStateDebugSnapshot(normalizedState);
}

function writeStateDebugSnapshot(state: State): void {
  mkdirSync("state", { recursive: true });
  writeFileSync(DEBUG_STATE_PATH, `${JSON.stringify(toStateExport(state), null, 2)}\n`, "utf-8");
}

function pruneExpiredParamModifiers(state: State): State {
  const currentAt = Temporal.Instant.from(state.public.clock.currentAt);
  for (const actor of Object.values(state.public.actors)) {
    const servantForm = actor.servantForm;
    if (servantForm === null) continue;
    servantForm.parameters.modifiers = servantForm.parameters.modifiers.filter((modifier) => {
      if (modifier.expiresAt === null) return true;
      return Temporal.Instant.compare(Temporal.Instant.from(modifier.expiresAt), currentAt) > 0;
    });
  }
  return state;
}

function toStateExport(state: State): StateExport {
  const snapshot = structuredClone(state);
  const humanTime = formatHumanTime(
    snapshot.public.clock.currentAt,
    snapshot.public.clock.timezone,
  );
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

function nextTurnLogId(entries: readonly TurnLogEntry[]): string {
  let highest = 0;
  for (const entry of entries) {
    const suffix = entry.id.startsWith("turn-") ? entry.id.slice("turn-".length) : "";
    if (!/^\d+$/.test(suffix)) continue;
    highest = Math.max(highest, Number(suffix));
  }
  return `turn-${highest + 1}`;
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
      turnLog: [],
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
  return parseStateSchema(migrateRawGameState(stateRaw));
}

function migrateRawGameState(raw: Record<string, unknown>): Record<string, unknown> {
  let current = structuredClone(raw);
  while (true) {
    const version = readRawSchemaVersion(current);
    if (version === CURRENT_STATE_SCHEMA_VERSION) {
      return current;
    }
    current = migrateOneSchemaVersion(current, version);
  }
}

function migrateOneSchemaVersion(
  raw: Record<string, unknown>,
  version: number,
): Record<string, unknown> {
  switch (version) {
    case 1:
      return migrateGameStateV1ToV2(raw);
    case 2:
      return migrateGameStateV2ToV3(raw);
    default:
      throw new Error(
        `不支持的 state schemaVersion: ${version}。当前支持逐步迁移到 ${CURRENT_STATE_SCHEMA_VERSION}。`,
      );
  }
}

function readRawSchemaVersion(raw: Record<string, unknown>): number {
  const meta = assertRecordForMigration(raw["meta"], "meta");
  return assertInteger(meta["schemaVersion"], "meta.schemaVersion");
}

function migrateGameStateV1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(raw);
  const meta = assertRecordForMigration(next["meta"], "meta");
  meta["schemaVersion"] = 2;
  const publicState = assertRecordForMigration(next["public"], "public");
  publicState["turnLog"] = [];
  return next;
}

function migrateGameStateV2ToV3(raw: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(raw);
  const meta = assertRecordForMigration(next["meta"], "meta");
  meta["schemaVersion"] = CURRENT_STATE_SCHEMA_VERSION;
  const publicState = assertRecordForMigration(next["public"], "public");
  const rawTurnLog = Array.isArray(publicState["turnLog"]) ? publicState["turnLog"] : [];
  publicState["turnLog"] = rawTurnLog.filter(hasAdvancingTurnTime);
  return next;
}

function hasAdvancingTurnTime(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const time = value["time"];
  if (!isRecord(time)) {
    return false;
  }
  return time["kind"] === "elapsed" || time["kind"] === "travel";
}

function assertRecordForMigration(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`非法 ${fieldName}: ${formatUnknown(value)}。迁移需要对象。`);
  }
  return value;
}

function touchState(state: State): State {
  return { ...state, meta: { ...state.meta, updatedAt: nowIso() } };
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
