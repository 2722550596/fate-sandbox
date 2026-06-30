// ---------------------------------------------------------------------------
// LOTM 晋升裁决系统 — 叙事先验引擎
//
// 设计哲学（与 combat-exchange-lotm.ts 一致）：
//   引擎不做数值计算，不代 LLM 决定成败。
//   只输出 outcome band + 叙事约束 + 必须落地的状态变更清单，
//   LLM 在约束内自由叙事。
//
// 对比战斗系统：
//   战斗是两方互动 → 输入是 actor/opponent + tactic + 优劣势
//   晋升是单人事件 → 输入是 actor + 目标 + 准备上下文
//   两者的 outcome 输出结构一致，rank 比较复用 lotm-rank.ts
// ---------------------------------------------------------------------------

import type { SequenceRank } from "../state/state-enum-schemas.ts";
import type { State, ActingCueProgress } from "../state/state.ts";

import { computeActingWeightedScore, getActingReadiness } from "../actor/acting.ts";
import { lotmRankDelta } from "../combat/lotm-rank.ts";
import { seededRandomInt } from "../utils/seeded-rng.ts";

// ===========================================================================
// 类型定义
// ===========================================================================

export type LOTMPromotionOutcomeBand =
  | "triumph" // 完美晋升，无代价——一切顺利
  | "success-with-cost" // 成功，但有代价（消耗品/伤势）
  | "scarred-success" // 成功，但有永久性代价（失去某样东西/失控）
  | "stabilized" // 没晋升也没失控——消耗了材料，维持现状
  | "loss-of-control" // 晋升失败，角色陷入失控边缘
  | "catastrophe"; // 完全失控/死亡，需要外界干预

/** 序列等级跳跃跨度 */
export type LOTMPromotionTierGap =
  | "same-tier" // 同层次（seq-9→seq-8, seq-7→seq-6）
  | "cross-boundary" // 跨大阶（低→中, 中→圣者, 圣者→天使）
  | "apotheosis"; // 成神或更高级别

/** 仪式完成度 */
export type LOTMRitualIntegrity = "none" | "improvised" | "standard" | "enhanced";

/** 环境风险 */
export type LOTMEnvironmentRisk = "safe" | "disturbed" | "hostile" | "chaotic";

/** 风险偏好 */
export type LOTMPromotionRiskTolerance = "low" | "medium" | "high" | "desperate";

// ===========================================================================
// 输入
// ===========================================================================

export interface LOTMPromotionInput {
  actorId: string;
  currentRank: SequenceRank;
  targetRank: SequenceRank;
  /** 扮演线索记录（引擎据此计算加权总分的消化准备程度） */
  actingCues: ActingCueProgress[];
  /** 当前游戏时间，用于检查时间闸 */
  currentTime: string;
  ritualIntegrity: LOTMRitualIntegrity;
  environmentRisk: LOTMEnvironmentRisk;
  hasMainCharacteristic: boolean;
  hasSupplementaryMaterials: boolean;
  riskTolerance: LOTMPromotionRiskTolerance;
}

// ===========================================================================
// 输出
// ===========================================================================

export type LOTMPromotionStateLandingKind =
  | "actor-sequence" // 序列状态变更
  | "actor-condition" // 角色状态变化（伤势/异常/消耗）
  | "inventory" // 材料消耗
  | "scene-threat" // 晋升动静引起外界注意
  | "memory" // 晋升记忆记录
  | "reveal-secret"; // 序列晋升可能需要秘密揭示

export interface LOTMPromotionStateLanding {
  kind: LOTMPromotionStateLandingKind;
  required: boolean;
  reason: string;
}

export interface LOTMPromotionResult {
  actorId: string;
  targetRank: SequenceRank;
  outcome: LOTMPromotionOutcomeBand;
  tierGap: LOTMPromotionTierGap;
  actingReadiness: string; // 引擎自动推导的准备程度
  actingCueCount: number;
  totalModifier: number;
  stateLandings: LOTMPromotionStateLanding[];
  consequenceGuidance: string[];
  narrativeConstraints: string[];
  forbiddenNarration: string[];
  nextActionWindow: string;
}

// ===========================================================================
// 主裁决函数
// ===========================================================================

export function resolveLOTMPromotion(
  _state: State,
  input: LOTMPromotionInput,
): LOTMPromotionResult {
  // 1. 等级差计算
  const rankDelta = lotmRankDelta(input.targetRank, input.currentRank);
  const gap = resolveTierGap(input.targetRank);

  // 2. 从扮演线索计算加权总分，推导准备程度
  const weightedScore = computeActingWeightedScore(input.actingCues);
  const actingReadiness = getActingReadiness(weightedScore);

  // 3. 上下文 modifier
  const modifier = computeContextModifier(input, actingReadiness);

  // 4. 确定 outcome
  const outcome = determinePromotionOutcome(rankDelta, gap, modifier, input);

  // 5. 构建输出
  const stateLandings = buildPromotionStateLandings(outcome, input);
  const consequenceGuidance = buildPromotionConsequenceGuidance(outcome);
  const narrativeConstraints = buildPromotionNarrativeConstraints(outcome, input, actingReadiness);
  const forbiddenNarration = buildPromotionForbiddenNarration(outcome);
  const nextActionWindow = buildPromotionNextActionWindow(outcome);

  return {
    actorId: input.actorId,
    targetRank: input.targetRank,
    outcome,
    tierGap: gap,
    actingReadiness,
    actingCueCount: input.actingCues.length,
    totalModifier: modifier,
    stateLandings,
    consequenceGuidance,
    narrativeConstraints,
    forbiddenNarration,
    nextActionWindow,
  };
}

// ===========================================================================
// 等级跨度计算
// ===========================================================================

function resolveTierGap(targetRank: SequenceRank): LOTMPromotionTierGap {
  if (targetRank === "seq-0" || targetRank === "old-one" || targetRank === "pillar") {
    return "apotheosis";
  }
  switch (targetRank) {
    case "seq-7":
    case "seq-6":
    case "seq-5":
    case "seq-4":
    case "seq-3":
    case "seq-2":
    case "seq-1":
      return "cross-boundary";
    default:
      return "same-tier";
  }
}

// ===========================================================================
// 上下文 modifier 计算
// ===========================================================================

function computeContextModifier(input: LOTMPromotionInput, actingReadiness: string): number {
  let mod = 0;

  // 扮演准备（引擎从 cue 条数推导）
  switch (actingReadiness) {
    case "raw":
      mod -= 3;
      break;
    case "partial":
      mod -= 1;
      break;
    case "ready":
      mod += 0;
      break;
    case "overprepared":
      mod += 1;
      break;
  }
  // 仪式完成度
  {
    const baseMod = (() => {
      switch (input.ritualIntegrity) {
        case "none":
          return -3;
        case "improvised":
          return -1;
        case "standard":
          return 0;
        case "enhanced":
          return 1;
        default:
          return 0;
      }
    })();
    mod += baseMod;
  }

  // 环境风险
  switch (input.environmentRisk) {
    case "safe":
      mod += 0;
      break;
    case "disturbed":
      mod -= 1;
      break;
    case "hostile":
      mod -= 2;
      break;
    case "chaotic":
      mod -= 3;
      break;
  }

  // 材料完整度（没有主材料不可能成功）
  if (!input.hasMainCharacteristic) mod -= 4;
  if (!input.hasSupplementaryMaterials) mod -= 1;

  return mod;
}

// ===========================================================================
// Outcome 判定
// ===========================================================================

function determinePromotionOutcome(
  rankDelta: number,
  tierGap: LOTMPromotionTierGap,
  modifier: number,
  input: LOTMPromotionInput,
): LOTMPromotionOutcomeBand {
  // 成神的 base 就是 catastrophe
  if (tierGap === "apotheosis") {
    return modifier >= 2 ? "scarred-success" : "catastrophe";
  }

  const total = rankDelta + modifier;

  // 没有主材料 → 不可能成功
  if (!input.hasMainCharacteristic && total < 2) {
    return "stabilized";
  }

  if (total <= -4) return "catastrophe";
  if (total <= -2) return "loss-of-control";
  if (total <= -0.5) return "stabilized";
  if (total <= 1) return "scarred-success";
  if (total <= 2.5) return "success-with-cost";
  return "triumph";
}

// ===========================================================================
// 状态落点
// ===========================================================================

function buildPromotionStateLandings(
  outcome: LOTMPromotionOutcomeBand,
  _input: LOTMPromotionInput,
): LOTMPromotionStateLanding[] {
  const landings: LOTMPromotionStateLanding[] = [];

  // 晋升必定伴随身体蜕变与精神冲击
  landings.push({
    kind: "actor-condition",
    required: outcome !== "stabilized",
    reason:
      outcome === "stabilized"
        ? "尝试晋升本身对身体造成了冲击，建议记录轻伤或灵感消耗"
        : "晋升必定伴随身体蜕变与精神冲击，需记录可审计的代价",
  });

  // 成功类 outcome → 序列状态更新
  if (outcome === "triumph" || outcome === "success-with-cost" || outcome === "scarred-success") {
    landings.push({
      kind: "actor-sequence",
      required: true,
      reason: `晋升成功：${_input.actorId} 更新序列至 ${_input.targetRank}，重置扮演记录`,
    });
    landings.push({
      kind: "inventory",
      required: true,
      reason: "晋升成功，消耗魔药材料（主特性+辅助材料）",
    });
    landings.push({
      kind: "memory",
      required: true,
      reason: "晋升事件作为重大记忆记录",
    });
  }

  // 失控 / 灾难 → 需要外部干预
  if (outcome === "loss-of-control" || outcome === "catastrophe") {
    landings.push({
      kind: "actor-condition",
      required: true,
      reason:
        outcome === "catastrophe"
          ? "晋升灾难：角色可能彻底失控/死亡/异变，需立刻外部干预"
          : "晋升失控：角色陷入失控边缘，需外部干预（队友/封印物/高阶非凡者）",
    });
    landings.push({
      kind: "inventory",
      required: outcome === "loss-of-control",
      reason:
        outcome === "loss-of-control" ? "晋升失败但材料已消耗" : "晋升灾难中材料可能损毁或散失",
    });
  }

  // 稳定但没有晋升
  if (outcome === "stabilized") {
    landings.push({
      kind: "inventory",
      required: false,
      reason: "材料可能已经消耗（取决于叙事中是否已使用），也可能可以留待下次",
    });
  }

  // 场景威胁
  if (outcome === "loss-of-control" || outcome === "catastrophe") {
    landings.push({
      kind: "scene-threat",
      required: true,
      reason: "晋升失控引发的异变必须作为场景威胁记录",
    });
  } else if (_input.environmentRisk === "hostile" || _input.environmentRisk === "chaotic") {
    landings.push({
      kind: "scene-threat",
      required: false,
      reason: "高风险环境中晋升，动静可能引起外界注意",
    });
  }

  // 秘密揭示
  if (outcome === "triumph" || outcome === "success-with-cost" || outcome === "scarred-success") {
    landings.push({
      kind: "reveal-secret",
      required: false,
      reason: "晋升后序列状态变化，如果 actor 的序列原本是秘密，需考虑是否触发 reveal_secret",
    });
  }

  return landings;
}

// ===========================================================================
// 后果引导
// ===========================================================================

function buildPromotionConsequenceGuidance(outcome: LOTMPromotionOutcomeBand): string[] {
  switch (outcome) {
    case "triumph":
      return [
        "晋升完美——一切按照预定轨迹进行，甚至超出预期",
        "可以突出 actor 对新力量的掌控感，晋升后的视野扩展",
      ];
    case "success-with-cost":
      return [
        "晋升成功，但付出了可审计的代价——伤势 / 灵感枯竭 / 物品损耗",
        "代价应和叙事中的风险对应：材料缺陷→药效不足，环境干扰→精神冲击",
      ];
    case "scarred-success":
      return [
        "成功晋升，但代价是永久性的——精神烙印、重要物品毁坏、长期后遗症",
        "actor 应获得序列能力，但也背负了可见的伤痕或精神创伤",
      ];
    case "stabilized":
      return [
        "晋升没有成功，但 actor 控制住了局面，没有失控",
        "材料可能已消耗或部分损坏，actor 需要重新准备",
        "这是一次挫折，不是终结——可以写 actor 总结经验，下次准备更充分",
      ];
    case "loss-of-control":
      return [
        "晋升失败，actor 陷入失控边缘——精神体受损，可能部分怪物化",
        "需要外部干预（队友、封印物、天使级存在）才能恢复",
        "如果无法恢复，actor 将永久异变为怪物/封印物",
      ];
    case "catastrophe":
      return [
        "晋升引发灾难性后果——actor 彻底失控/爆炸/异变",
        "可能需要其他角色介入拯救，或者这条故事线就此终结（角色死亡）",
        "如果 actor 有特殊身份（主角/关键 NPC），可设计为「假死」或「被高位存在接管」",
      ];
  }
  return [];
}

// ===========================================================================
// 叙事约束
// ===========================================================================

function buildPromotionNarrativeConstraints(
  outcome: LOTMPromotionOutcomeBand,
  input: LOTMPromotionInput,
  actingReadiness: string,
): string[] {
  const constraints: string[] = [];

  constraints.push(`晋升目标：${input.currentRank} → ${input.targetRank}`);
  constraints.push(`扮演积累：${input.actingCues.length} 条（${actingReadiness}）`);

  if (outcome === "triumph" || outcome === "success-with-cost" || outcome === "scarred-success") {
    constraints.push("晋升成功后 actor 获得新序列的能力，可参考对应能力列表描写");
    constraints.push("晋升过程中 actor 会看到非凡特性中的精神烙印残留（前任宿主的记忆片段）");
  }

  // 材料约束
  if (input.hasMainCharacteristic) {
    constraints.push("主非凡特性包含前任主人的精神烙印——晋升时写入 actor 的「非凡体验」");
  }
  if (!input.hasSupplementaryMaterials) {
    constraints.push("缺少辅助材料，魔药的疯狂倾向中和不足——描写精神冲击和幻觉放大");
  }

  // 仪式约束
  if (
    input.ritualIntegrity === "none" &&
    input.targetRank !== "seq-0" &&
    input.targetRank !== "old-one" &&
    input.targetRank !== "pillar"
  ) {
    constraints.push("未准备晋升仪式——序列6以上的晋升在无仪式下几乎必然失控或失败");
  }

  // 环境约束
  if (input.environmentRisk === "hostile") {
    constraints.push("敌对环境中晋升——外部威胁可能干扰晋升过程，增加紧张感");
  }
  if (input.environmentRisk === "chaotic") {
    constraints.push("极度混乱环境中晋升——晋升随时可能被外界打断，后果不可预测");
  }

  // 扮演不足的失控指导（叙事层面，非数值）
  if (actingReadiness === "raw") {
    constraints.push(
      "扮演积累严重不足（<6 条），晋升过程中的失控倾向会极其强烈——突出精神崩溃边缘的挣扎",
    );
  } else if (actingReadiness === "partial") {
    constraints.push("扮演积累尚可（6-9 条），但未达到理想状态，晋升中的精神冲击会比正常更强");
  }

  return constraints;
}

// ===========================================================================
// 禁止写法
// ===========================================================================

function buildPromotionForbiddenNarration(outcome: LOTMPromotionOutcomeBand): string[] {
  switch (outcome) {
    case "triumph":
    case "success-with-cost":
      return [
        "不能写 actor 完全掌控新力量（消化从 0 开始）——晋升成功不等于消化完成",
        "不能写 actor 获得不属于目标序列的能力",
        "不能写晋升过程无感——晋升必定伴随精神冲击和身体蜕变",
      ];
    case "scarred-success":
      return [
        "不能无视永久性代价的存在——伤痕、精神烙印必须可见",
        "不能写 actor 短期内再次晋升——这次晋升已经触到了极限",
        "不能写外部观察者毫无察觉——晋升的动静不可能完全隐蔽",
      ];
    case "stabilized":
      return [
        "不能写 actor 完全没有付出——尝试晋升本身就是消耗",
        "不能写「下次一定成功」的保证——晋升没有必然成功的承诺",
      ];
    case "loss-of-control":
      return [
        "不能写 actor 自己轻松恢复控制——失控需要外部干预",
        "不能写晋升材料完好无损——材料已在晋升中消耗",
        "不能写其他人毫无察觉——失控会引发异常现象",
      ];
    case "catastrophe":
      return [
        "不能写 actor 轻易获救——灾难级后果需要匹配的叙事分量",
        "不能写晋升材料仍可回收——材料已经损毁或散失",
        "不能写周围环境毫无影响——天使级以上的灾难可能波及整个区域",
      ];
  }
  return [];
}

// ===========================================================================
// 下一行动窗口
// ===========================================================================

function buildPromotionNextActionWindow(outcome: LOTMPromotionOutcomeBand): string {
  switch (outcome) {
    case "triumph":
      return "晋升完成，actor 需要时间适应新力量。下一行动可以是测试能力、寻找下一个序列配方、或处理晋升引起的注意。";
    case "success-with-cost":
      return "晋升成功但需要休整——处理伤势、补充消耗品、评估晋升后的状态变化。";
    case "scarred-success":
      return "晋升成功了，但 actor 正处于最脆弱的时刻——需要立刻评估永久代价的影响，可能寻求治疗或庇护。";
    case "stabilized":
      return "尝试晋升失败，但至少没有失控。下一行动是分析失败原因、补充材料、改进仪式准备。";
    case "loss-of-control":
      return "⚠ 紧急状态：actor 正在失控边缘！其他角色必须立即介入——使用封印物、高阶非凡者压制、或引导失控能量宣泄。";
    case "catastrophe":
      return "⚠ 灾难响应：actor 可能已经死亡或异变。其他角色需要应对失控现场——压制怪物、疏散区域、或撤离现场。";
  }
  return "晋升流程结束。";
}

// ===========================================================================
// Swing 骰（可选，与战斗系统共用）
// ===========================================================================

export type LOTMSwing = "bad-break" | "pressure" | "neutral" | "opening" | "turnabout";

export function rollLOTMSwing(state: State): LOTMSwing {
  const roll = seededRandomInt(state, 100);
  if (roll < 10) return "bad-break";
  if (roll < 30) return "pressure";
  if (roll < 70) return "neutral";
  if (roll < 90) return "opening";
  return "turnabout";
}

/** 将 swing 转换成 modifier 偏移 */
export function swingModifier(swing: LOTMSwing): number {
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
  }
  return 0;
}
