import type { FateParams, FateRank, PublicActorState } from "./state";

import { compareFateRanks, type FateRankComparison } from "./fate-rank";
import { getState } from "./state";

export type CombatExchangeTactic =
  | "direct-attack"
  | "defense"
  | "escape"
  | "protect"
  | "probe"
  | "break-restraint"
  | "noble-phantasm"
  | "support";
export type CombatRiskTolerance = "low" | "medium" | "high" | "desperate";
export type CombatOutcomeBand =
  | "clean-advantage"
  | "advantage-with-cost"
  | "exchange"
  | "forced-defense"
  | "failed-with-cost"
  | "overwhelmed";
export type CombatScale = "servant" | "mage" | "mundane";
export type CombatStateLandingKind =
  | "scene-objective"
  | "scene-threat"
  | "actor-condition"
  | "servant-form"
  | "memory"
  | "reveal-secret";
export type CombatParameter = keyof FateParams;
export type RawCombatExchangeInput = Record<string, unknown>;

export interface CombatExchangeInput {
  actorId: string;
  opponentId: string;
  intent: string;
  tactic: CombatExchangeTactic;
  actorParameter: CombatParameter;
  opponentParameter: CombatParameter;
  targetObjective?: string;
  committedResources: string[];
  knownAdvantages: string[];
  knownDisadvantages: string[];
  riskTolerance: CombatRiskTolerance;
}

export interface CombatStateLanding {
  kind: CombatStateLandingKind;
  required: boolean;
  reason: string;
}

export interface CombatExchangeResult {
  actorId: string;
  opponentId: string;
  intent: string;
  tactic: CombatExchangeTactic;
  outcome: CombatOutcomeBand;
  score: number;
  rankCheck: string;
  stateLandings: CombatStateLanding[];
  narrativeConstraints: string[];
  forbiddenNarration: string[];
  nextActionWindow: string;
}

interface CombatProfile {
  scale: CombatScale;
  rank: FateRank | null;
  label: string;
}

const COMBAT_TACTICS = [
  "direct-attack",
  "defense",
  "escape",
  "protect",
  "probe",
  "break-restraint",
  "noble-phantasm",
  "support",
] as const satisfies readonly CombatExchangeTactic[];
const RISK_TOLERANCES = [
  "low",
  "medium",
  "high",
  "desperate",
] as const satisfies readonly CombatRiskTolerance[];
const COMBAT_PARAMETERS = [
  "strength",
  "endurance",
  "agility",
  "mana",
  "luck",
  "noblePhantasm",
] as const satisfies readonly CombatParameter[];
const EMPTY_MARKERS = new Set(["none", "无", "n/a", "null"]);

export function assertCombatExchangeInput(raw: RawCombatExchangeInput): CombatExchangeInput {
  return {
    actorId: assertString(raw["actorId"], "actorId"),
    opponentId: assertString(raw["opponentId"], "opponentId"),
    intent: assertString(raw["intent"], "intent"),
    tactic: assertOneOf(raw["tactic"], "tactic", COMBAT_TACTICS),
    actorParameter: assertOneOf(raw["actorParameter"], "actorParameter", COMBAT_PARAMETERS),
    opponentParameter: assertOneOf(
      raw["opponentParameter"],
      "opponentParameter",
      COMBAT_PARAMETERS,
    ),
    targetObjective: assertOptionalString(raw["targetObjective"], "targetObjective"),
    committedResources: normalizeStringArray(raw["committedResources"], "committedResources"),
    knownAdvantages: normalizeStringArray(raw["knownAdvantages"], "knownAdvantages"),
    knownDisadvantages: normalizeStringArray(raw["knownDisadvantages"], "knownDisadvantages"),
    riskTolerance: assertOneOf(raw["riskTolerance"], "riskTolerance", RISK_TOLERANCES),
  };
}

export function resolveCombatExchange(input: CombatExchangeInput): CombatExchangeResult {
  const state = getState();
  const actor = requireActor(state.public.actors[input.actorId], input.actorId);
  const opponent = requireActor(state.public.actors[input.opponentId], input.opponentId);
  const actorProfile = buildCombatProfile(actor, input.actorParameter);
  const opponentProfile = buildCombatProfile(opponent, input.opponentParameter);
  const rankComparison = compareProfiles(actorProfile, opponentProfile);
  const score = calculateScore(input, actor, opponent, rankComparison);
  const outcome = determineOutcome(score, input);
  return {
    actorId: input.actorId,
    opponentId: input.opponentId,
    intent: input.intent,
    tactic: input.tactic,
    outcome,
    score,
    rankCheck: formatRankCheck(actorProfile, opponentProfile, rankComparison),
    stateLandings: buildStateLandings(input, outcome, actorProfile),
    narrativeConstraints: buildNarrativeConstraints(input, outcome, rankComparison),
    forbiddenNarration: buildForbiddenNarration(outcome),
    nextActionWindow: buildNextActionWindow(input, outcome),
  };
}

function requireActor(actor: PublicActorState | undefined, actorId: string): PublicActorState {
  if (actor === undefined) {
    throw new Error(`resolve_combat_exchange: actor ${actorId} 不存在。`);
  }
  return actor;
}

function buildCombatProfile(actor: PublicActorState, parameter: CombatParameter): CombatProfile {
  if (actor.servantForm !== null) {
    return {
      scale: "servant",
      rank: actor.servantForm.parameters.base[parameter],
      label: `${actor.presentation.displayName}/${actor.servantForm.identity.className}.${parameter}`,
    };
  }
  if (actor.magecraft !== null) {
    return {
      scale: "mage",
      rank: mageRank(actor, parameter),
      label: `${actor.presentation.displayName}/magecraft.${parameter}`,
    };
  }
  return {
    scale: "mundane",
    rank: null,
    label: `${actor.presentation.displayName}/mundane.${parameter}`,
  };
}

function mageRank(actor: PublicActorState, parameter: CombatParameter): FateRank | null {
  if (actor.magecraft === null) {
    return null;
  }
  if (parameter === "mana" && actor.magecraft.circuits.quality !== "none") {
    return actor.magecraft.circuits.quality;
  }
  if (parameter !== "mana" && parameter !== "noblePhantasm") {
    return null;
  }
  return bestDisciplineRank(actor.magecraft.disciplines.map((discipline) => discipline.rank));
}

function bestDisciplineRank(ranks: ReadonlyArray<FateRank | "none">): FateRank | null {
  let best: FateRank | null = null;
  for (const rank of ranks) {
    if (rank === "none") {
      continue;
    }
    if (best === null || compareFateRanks(rank, best).mainRankDelta > 0) {
      best = rank;
    }
  }
  return best;
}

function compareProfiles(
  actorProfile: CombatProfile,
  opponentProfile: CombatProfile,
): FateRankComparison | null {
  if (actorProfile.rank === null || opponentProfile.rank === null) {
    return null;
  }
  return compareFateRanks(actorProfile.rank, opponentProfile.rank);
}

function calculateScore(
  input: CombatExchangeInput,
  actor: PublicActorState,
  opponent: PublicActorState,
  rankComparison: FateRankComparison | null,
): number {
  return (
    rankScore(rankComparison) +
    scaleScore(actor, opponent) +
    factorScore(input) +
    vulnerabilityScore(opponent) -
    vulnerabilityScore(actor)
  );
}

function rankScore(comparison: FateRankComparison | null): number {
  if (comparison === null) {
    return 0;
  }
  return comparison.mainRankDelta * 2 + clamp(comparison.modifierDelta, -1, 1);
}

function scaleScore(actor: PublicActorState, opponent: PublicActorState): number {
  return scaleValue(actorScale(actor)) - scaleValue(actorScale(opponent));
}

function actorScale(actor: PublicActorState): CombatScale {
  if (actor.servantForm !== null) {
    return "servant";
  }
  if (actor.magecraft !== null) {
    return "mage";
  }
  return "mundane";
}

function scaleValue(scale: CombatScale): number {
  switch (scale) {
    case "servant":
      return 3;
    case "mage":
      return 1;
    case "mundane":
      return 0;
    default:
      throw new Error("unreachable combat scale");
  }
}

function factorScore(input: CombatExchangeInput): number {
  return (
    Math.min(input.committedResources.length, 2) +
    Math.min(input.knownAdvantages.length, 3) -
    Math.min(input.knownDisadvantages.length, 3) +
    riskScore(input.riskTolerance)
  );
}

function riskScore(riskTolerance: CombatRiskTolerance): number {
  switch (riskTolerance) {
    case "low":
      return -1;
    case "medium":
      return 0;
    case "high":
    case "desperate":
      return 1;
    default:
      throw new Error("unreachable combat risk tolerance");
  }
}

function vulnerabilityScore(actor: PublicActorState): number {
  return woundVulnerability(actor) + servantVulnerability(actor);
}

function woundVulnerability(actor: PublicActorState): number {
  return actor.condition.wounds.reduce((score, wound) => {
    switch (wound.severity) {
      case "minor":
        return score;
      case "moderate":
        return score + 1;
      case "severe":
        return score + 2;
      case "critical":
        return score + 3;
      default:
        throw new Error("unreachable wound severity");
    }
  }, 0);
}

function servantVulnerability(actor: PublicActorState): number {
  const servant = actor.servantForm;
  if (servant === null) {
    return 0;
  }
  return (
    resourceVulnerability(servant.condition.mana.value) +
    resourceVulnerability(servant.condition.spiritualCore.value)
  );
}

function resourceVulnerability(value: number): number {
  if (value <= 20) {
    return 2;
  }
  if (value <= 40) {
    return 1;
  }
  return 0;
}

function determineOutcome(score: number, input: CombatExchangeInput): CombatOutcomeBand {
  if (score >= 5) {
    return input.riskTolerance === "high" || input.riskTolerance === "desperate"
      ? "advantage-with-cost"
      : "clean-advantage";
  }
  if (score >= 2) {
    return "advantage-with-cost";
  }
  if (score >= -1) {
    return "exchange";
  }
  if (score >= -4) {
    return input.riskTolerance === "desperate" ? "failed-with-cost" : "forced-defense";
  }
  return "overwhelmed";
}

function formatRankCheck(
  actorProfile: CombatProfile,
  opponentProfile: CombatProfile,
  rankComparison: FateRankComparison | null,
): string {
  if (rankComparison === null) {
    return `${actorProfile.label} vs ${opponentProfile.label}: 至少一方缺少可比较 Fate rank；以尺度、资源、伤势、情报与行动目标裁决。`;
  }
  return `${actorProfile.label} ${rankComparison.left} vs ${opponentProfile.label} ${rankComparison.right}: ${rankComparison.narrative}`;
}

function buildStateLandings(
  input: CombatExchangeInput,
  outcome: CombatOutcomeBand,
  actorProfile: CombatProfile,
): CombatStateLanding[] {
  const landings: CombatStateLanding[] = [
    {
      kind: "scene-objective",
      required: true,
      reason:
        input.targetObjective === undefined
          ? `交锋必须说明「${input.intent}」推进、受阻或转化成哪个下一窗口。`
          : `交锋必须落到当前目标：${input.targetObjective}。`,
    },
  ];
  if (outcome !== "clean-advantage") {
    landings.push({
      kind: "scene-threat",
      required: true,
      reason: "非无损优势必须保留威胁、距离压力或敌方下一手。",
    });
  }
  if (requiresActorCost(outcome, input.riskTolerance)) {
    landings.push({
      kind: "actor-condition",
      required: true,
      reason: "高风险或失利交锋需要伤势、疲劳、失衡、暴露或其他可审计代价。",
    });
  }
  if (actorProfile.scale === "servant" && requiresServantCost(outcome, input)) {
    landings.push({
      kind: "servant-form",
      required: true,
      reason: "从者高强度交锋、宝具或不利交换需要魔力/灵核/参数修正落点。",
    });
  }
  if (input.tactic === "noble-phantasm") {
    landings.push({
      kind: "memory",
      required: true,
      reason: "宝具级行动若被玩家确认，需要长期记忆或揭示链路承接。",
    });
    landings.push({
      kind: "reveal-secret",
      required: false,
      reason: "若宝具名、真名或隐藏能力从线索变成公开事实，必须走 reveal_secret。",
    });
  }
  return landings;
}

function requiresActorCost(
  outcome: CombatOutcomeBand,
  riskTolerance: CombatRiskTolerance,
): boolean {
  return (
    outcome === "advantage-with-cost" ||
    outcome === "forced-defense" ||
    outcome === "failed-with-cost" ||
    outcome === "overwhelmed" ||
    riskTolerance === "high" ||
    riskTolerance === "desperate"
  );
}

function requiresServantCost(outcome: CombatOutcomeBand, input: CombatExchangeInput): boolean {
  return (
    input.tactic === "noble-phantasm" ||
    input.committedResources.length > 0 ||
    outcome !== "clean-advantage"
  );
}

function buildNarrativeConstraints(
  input: CombatExchangeInput,
  outcome: CombatOutcomeBand,
  rankComparison: FateRankComparison | null,
): string[] {
  const constraints = [
    "交锋裁决只覆盖当前动作窗口；不要借此直接写完整场战斗结束，除非当前目标就是终结战斗且状态落点已处理。",
    "结果必须落到位置、距离、伤势、魔力、目标推进、威胁变化或可回应窗口；不要写成纯气势胜负。",
    "骰子或气氛不能覆盖 Fate 参数压制、Locked Facts、真名/宝具信息安全与已记录伤势。",
  ];
  if (rankComparison?.band === "overwhelming") {
    constraints.push(
      "两级以上参数压制默认成立；低位方只能靠相性、地形、情报、牺牲资源或改换目标争取局部窗口。",
    );
  }
  if (input.riskTolerance === "high" || input.riskTolerance === "desperate") {
    constraints.push("高风险投入必须留下代价；成功也不能写成免费干净成功。");
  }
  if (outcome === "overwhelmed") {
    constraints.push(
      "被压制方不得正面赢下交换；只能保住局部目标、被迫退让、付出代价或等待新资源介入。 ",
    );
  }
  return constraints;
}

function buildForbiddenNarration(outcome: CombatOutcomeBand): string[] {
  const forbidden = [
    "禁止输出 HP、伤害数字、DC、score 或内部字段。",
    "禁止把未揭示的真名、宝具、弱点或幕后判断直接写进玩家视角。",
    "禁止把无资源投入的高风险行动写成免费成功。",
  ];
  if (outcome === "overwhelmed") {
    forbidden.push("禁止让被压制方靠决心、气势或一句台词正面反杀。 ");
  }
  return forbidden;
}

function buildNextActionWindow(input: CombatExchangeInput, outcome: CombatOutcomeBand): string {
  switch (outcome) {
    case "clean-advantage":
      return `「${input.intent}」取得局部主动；停在是否追击、撤离、逼问、保护目标或扩大战果的选择点。`;
    case "advantage-with-cost":
      return `「${input.intent}」推进成功但代价已经显现；停在是否承受代价继续、转入防守或要求支援的选择点。`;
    case "exchange":
      return `「${input.intent}」与对方应对相互抵消；停在距离、情报或目标出现新缺口的选择点。`;
    case "forced-defense":
      return `「${input.intent}」被迫转为防守；停在撤退、保护同伴、投入资源或改换目标的选择点。`;
    case "failed-with-cost":
      return `「${input.intent}」失败且代价落下；停在处理伤势/失衡/暴露或请求援护的选择点。`;
    case "overwhelmed":
      return `「${input.intent}」遭到压制；停在是否付出更高代价、利用地形相性、撤退或等待外部窗口的选择点。`;
    default:
      throw new Error("unreachable combat outcome");
  }
}

function normalizeStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是数组。`);
  }
  return value
    .map((entry, index) => assertString(entry, `${fieldName}[${index}]`))
    .filter(isMeaningfulFactor);
}

function isMeaningfulFactor(value: string): boolean {
  return !EMPTY_MARKERS.has(value.toLowerCase());
}

function assertOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertString(value, fieldName);
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} 必须是字符串。`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return trimmed;
}

function assertOneOf<const T extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowed: T,
): T[number] {
  const text = assertString(value, fieldName);
  for (const candidate of allowed) {
    if (text === candidate) {
      return candidate;
    }
  }
  throw new Error(`非法 ${fieldName}: ${text}。允许值: ${allowed.join(", ")}。`);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
