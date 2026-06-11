import type {
  CombatExchangeTactic,
  CombatRiskTolerance,
  CombatSwing,
} from "./combat-exchange-schema.ts";
import type { FateParams, FateRank, NoblePhantasm, PublicActorState, State } from "./state.ts";

import { compareFateRanks, type FateRankComparison } from "./fate-rank.ts";

export type {
  CombatExchangeTactic,
  CombatRiskTolerance,
  CombatSwing,
} from "./combat-exchange-schema.ts";

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

export interface CombatExchangeInput {
  actorId: string;
  opponentId: string;
  intent: string;
  tactic: CombatExchangeTactic;
  actorParameter: CombatParameter;
  opponentParameter: CombatParameter;
  actorNoblePhantasmName?: string;
  opponentNoblePhantasmName?: string;
  targetObjective?: string;
  committedResources: string[];
  knownAdvantages: string[];
  knownDisadvantages: string[];
  riskTolerance: CombatRiskTolerance;
  swing?: CombatSwing;
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
  swing: CombatSwing;
  rankCheck: string;
  stateLandings: CombatStateLanding[];
  consequenceGuidance: string[];
  narrativeConstraints: string[];
  forbiddenNarration: string[];
  nextActionWindow: string;
}

interface CombatProfile {
  scale: CombatScale;
  rank: FateRank | null;
  label: string;
}

export function resolveCombatExchange(
  state: State,
  input: CombatExchangeInput,
): CombatExchangeResult {
  const actor = requireActor(state.public.actors[input.actorId], input.actorId);
  const opponent = requireActor(state.public.actors[input.opponentId], input.opponentId);
  const actorProfile = buildCombatProfile(
    actor,
    input.actorParameter,
    input.tactic,
    input.actorNoblePhantasmName,
    "actorNoblePhantasmName",
  );
  const opponentProfile = buildCombatProfile(
    opponent,
    input.opponentParameter,
    input.tactic,
    input.opponentNoblePhantasmName,
    "opponentNoblePhantasmName",
  );
  const rankComparison = compareProfiles(actorProfile, opponentProfile);
  const swing = combatSwing(input);
  const score = calculateScore(input, actor, opponent, rankComparison);
  const outcome = determineOutcome(score, input);
  return {
    actorId: input.actorId,
    opponentId: input.opponentId,
    intent: input.intent,
    tactic: input.tactic,
    outcome,
    score,
    swing,
    rankCheck: formatRankCheck(actorProfile, opponentProfile, rankComparison),
    stateLandings: buildStateLandings(input, outcome, actorProfile),
    consequenceGuidance: buildConsequenceGuidance(outcome, swing),
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

function shouldUseConcreteNoblePhantasm(
  parameter: CombatParameter,
  tactic: CombatExchangeTactic,
  noblePhantasmName: string | undefined,
): boolean {
  return (
    parameter === "noblePhantasm" &&
    (tactic === "noble-phantasm" || noblePhantasmName !== undefined)
  );
}

function selectConcreteNoblePhantasm(
  actor: PublicActorState,
  noblePhantasmName: string | undefined,
  noblePhantasmFieldName: string,
): { name: string; rank: FateRank } {
  const servant = actor.servantForm;
  if (servant === null) {
    throw new Error(`resolve_combat_exchange: ${actor.id} 不是从者，不能指定具体宝具。`);
  }
  const revealedNoblePhantasms = servant.noblePhantasms.filter(isConcreteNoblePhantasm);
  if (noblePhantasmName !== undefined) {
    const matched = revealedNoblePhantasms.find(
      (noblePhantasm) => noblePhantasm.name === noblePhantasmName,
    );
    if (matched === undefined) {
      throw new Error(
        `resolve_combat_exchange: ${noblePhantasmFieldName} 未匹配公开宝具。可用: ${formatAvailableNoblePhantasms(revealedNoblePhantasms)}。`,
      );
    }
    return { name: matched.name, rank: matched.rank };
  }
  if (revealedNoblePhantasms.length !== 1) {
    throw new Error(
      `resolve_combat_exchange: ${actor.id} 的公开宝具数量为 ${revealedNoblePhantasms.length}，必须用 ${noblePhantasmFieldName} 指定唯一宝具。可用: ${formatAvailableNoblePhantasms(revealedNoblePhantasms)}。`,
    );
  }
  const onlyNoblePhantasm = revealedNoblePhantasms[0];
  if (onlyNoblePhantasm === undefined) {
    throw new Error(`resolve_combat_exchange: ${actor.id} 缺少可用公开宝具。`);
  }
  return { name: onlyNoblePhantasm.name, rank: onlyNoblePhantasm.rank };
}

function isConcreteNoblePhantasm(
  noblePhantasm: NoblePhantasm,
): noblePhantasm is NoblePhantasm & { rank: FateRank } {
  return noblePhantasm.status !== "hidden" && noblePhantasm.rank !== "none";
}

function formatAvailableNoblePhantasms(
  noblePhantasms: ReadonlyArray<{ name: string; rank: FateRank }>,
): string {
  if (noblePhantasms.length === 0) {
    return "无";
  }
  return noblePhantasms
    .map((noblePhantasm) => `「${noblePhantasm.name}」(${noblePhantasm.rank})`)
    .join("、");
}

function buildCombatProfile(
  actor: PublicActorState,
  parameter: CombatParameter,
  tactic: CombatExchangeTactic,
  noblePhantasmName: string | undefined,
  noblePhantasmFieldName: string,
): CombatProfile {
  if (actor.servantForm !== null) {
    if (shouldUseConcreteNoblePhantasm(parameter, tactic, noblePhantasmName)) {
      const noblePhantasm = selectConcreteNoblePhantasm(
        actor,
        noblePhantasmName,
        noblePhantasmFieldName,
      );
      return {
        scale: "servant",
        rank: noblePhantasm.rank,
        label: `${actor.presentation.displayName}/${actor.servantForm.identity.className}.宝具「${noblePhantasm.name}」`,
      };
    }
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
    swingScore(combatSwing(input)) +
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

function combatSwing(input: CombatExchangeInput): CombatSwing {
  return input.swing ?? "neutral";
}

function swingScore(swing: CombatSwing): number {
  switch (swing) {
    case "bad-break":
      return -2;
    case "pressure":
      return -1;
    case "neutral":
      return 0;
    case "opening":
      return 1;
    case "turnabout":
      return 2;
    default:
      throw new Error("unreachable combat swing");
  }
}

export function formatCombatSwing(swing: CombatSwing): string {
  switch (swing) {
    case "bad-break":
      return "恶化变数：敌方抓到节奏或环境突然转坏。";
    case "pressure":
      return "压力变数：火线、距离或误判让行动更吃紧。";
    case "neutral":
      return "平稳变数：没有额外偏移，按参数、资源和目标裁决。";
    case "opening":
      return "开口变数：出现短暂位置、节奏或判断破绽。";
    case "turnabout":
      return "逆转变数：罕见破绽放大，允许低位方争取局部翻盘窗口。";
    default:
      throw new Error("unreachable combat swing");
  }
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
      reason: "失利或绝境交锋需要伤势、疲劳、失衡、暴露或其他可审计代价。",
    });
  } else if (input.riskTolerance === "high" || input.riskTolerance === "desperate") {
    landings.push({
      kind: "actor-condition",
      required: false,
      reason: "高风险代价可落在疲劳、失衡或暴露；若已由魔力、位置或敌方下一手承接，可不写伤势。",
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
    outcome === "forced-defense" ||
    outcome === "failed-with-cost" ||
    outcome === "overwhelmed" ||
    (outcome === "advantage-with-cost" && riskTolerance === "desperate")
  );
}

function requiresServantCost(outcome: CombatOutcomeBand, input: CombatExchangeInput): boolean {
  return (
    input.tactic === "noble-phantasm" ||
    input.committedResources.length > 0 ||
    outcome !== "clean-advantage"
  );
}

function buildConsequenceGuidance(outcome: CombatOutcomeBand, swing: CombatSwing): string[] {
  const guidance: string[] = [];
  switch (outcome) {
    case "clean-advantage":
      guidance.push("给出明确战果：位置、火线、阵型、距离或目标进度至少改变一项。");
      break;
    case "advantage-with-cost":
      guidance.push("战果要大于一句挡住：允许切开火力、撕出通路、逼退一步或迫使敌方改手。");
      guidance.push("代价优先落到魔力、暴露、位置或倒计时；不要默认每次都写伤势。");
      break;
    case "exchange":
      guidance.push("双方都要有后果：至少交换位置、情报、资源、距离或下一手主动权。");
      break;
    case "forced-defense":
      guidance.push("防守不是原地卡住：必须给出撤退路线、保护窗口、资源投入口或改换目标。");
      break;
    case "failed-with-cost":
    case "overwhelmed":
      guidance.push("失败后果可以重：位置崩坏、保护目标受压、资源大耗、暴露弱点或被迫分离。");
      break;
    default:
      throw new Error("unreachable combat outcome");
  }
  if (swing === "opening" || swing === "turnabout") {
    guidance.push("有利变数可以打破单调等级压制，但只能兑现为局部窗口、资源交换或目标推进。");
  }
  if (swing === "bad-break" || swing === "pressure") {
    guidance.push("不利变数应扩大局势后果，而不是只把动作写成失败。");
  }
  return guidance;
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
    constraints.push(
      "高风险投入必须留下代价，但代价可落在魔力、暴露、位置、倒计时或敌方下一手；不要每次都写伤势或停手。",
    );
  }
  if (outcome === "overwhelmed") {
    constraints.push(
      "被压制方不得正面赢下交换；只能保住局部目标、被迫退让、付出代价或等待新资源介入。",
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
    forbidden.push("禁止让被压制方靠决心、气势或一句台词正面反杀。");
  }
  return forbidden;
}

function buildNextActionWindow(input: CombatExchangeInput, outcome: CombatOutcomeBand): string {
  switch (outcome) {
    case "clean-advantage":
      return `「${input.intent}」取得局部主动；推进到追击、撤离、逼问、保护目标或扩大战果的选择点。`;
    case "advantage-with-cost":
      return `「${input.intent}」推进成功且代价显现；推进到承受代价继续、转入防守或要求支援的选择点。`;
    case "exchange":
      return `「${input.intent}」与对方应对相互抵消；推进到距离、情报或目标出现新缺口的选择点。`;
    case "forced-defense":
      return `「${input.intent}」被迫转为防守；推进到撤退、保护同伴、投入资源或改换目标的选择点。`;
    case "failed-with-cost":
      return `「${input.intent}」失败且代价落下；推进到处理伤势/失衡/暴露或请求援护的选择点。`;
    case "overwhelmed":
      return `「${input.intent}」遭到压制；推进到付出更高代价、利用地形相性、撤退或等待外部窗口的选择点。`;
    default:
      throw new Error("unreachable combat outcome");
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
