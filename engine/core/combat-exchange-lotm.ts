// ---------------------------------------------------------------------------
// LOTM 战斗交换系统 — 叙事先验引擎
//
// 设计哲学：
//   引擎不做数值计算，只做叙事裁决。
//   输出 outcome band + 叙事约束 + 必须落地的状态变更清单，
//   LLM 在约束内自由叙事。
//
// 复用 fate-sandbox 的 combat-exchange.ts 的架构，
// 但适配 LOTM 的序列等级/途径设定。
// ---------------------------------------------------------------------------

import type { FateToolDefinition } from "../tools/runtime/tool-definition.ts";
import type { ToolResult } from "../tools/runtime/tool-result.ts";
import type { LOTMRankComparison } from "./lotm-rank.ts";
import type { SequenceRank } from "./state/state-enum-schemas.ts";
import type { State } from "./state/state.ts";

import { Type } from "typebox";

import { noNumberNarrativeHint } from "../tools/runtime/narrative-hints.ts";
import { runDomainEventTool } from "../tools/system/domain-tool-runner.ts";
import { compareLOTMRanks } from "./lotm-rank.ts";
import { recordObligation } from "./ledger/obligations.ts";
import { SEQUENCE_RANKS } from "./state/state-enum-schemas.ts";
import { seededRandomInt } from "./utils/seeded-rng.ts";
import { assertOneOfString, assertOptionalOneOfString } from "./utils/string-enum.ts";
import { isRecord } from "./utils/typebox-validation.ts";

// ===========================================================================
// 类型定义
// ===========================================================================

export type LOTMOutcomeBand =
  | "clean-advantage" // 完全优势，无代价
  | "advantage-with-cost" // 优势但有代价
  | "exchange" // 交换，双方都有所得/所失
  | "forced-defense" // 被迫防守
  | "failed-with-cost" // 失败且付出代价
  | "overwhelmed"; // 完全被压制

export type LOTMStateLandingKind =
  | "scene-objective" // 场景目标推进
  | "scene-threat" // 场景威胁变化
  | "actor-condition" // 角色状态变化（伤势/异常/消耗）
  | "equipment" // 装备状态变化
  | "memory" // 记忆记录
  | "reveal-secret"; // 秘密揭示

export type LOTMTactic =
  | "direct-attack" // 直接攻击
  | "defense" // 防御/格挡
  | "escape" // 逃跑
  | "protect" // 保护
  | "probe" // 试探
  | "break-restraint" // 破除束缚
  | "use-ability" // 使用超凡能力
  | "support"; // 支援

export type LOTMRiskTolerance = "low" | "medium" | "high" | "desperate";

export type LOTMSwing =
  | "bad-break" // 恶化
  | "pressure" // 压力
  | "neutral" // 平稳
  | "opening" // 机会
  | "turnabout"; // 逆转

// ===========================================================================
// 战斗交换输入
// ===========================================================================

export interface LOTMCombatExchangeInput {
  actorId: string;
  opponentId: string;
  intent: string; // 当前动作意图，如"掩护队友撤退"
  tactic: LOTMTactic;
  actorRank: SequenceRank; // 攻击方序列等级
  opponentRank: SequenceRank; // 防御方序列等级
  actorEquipmentRank?: SequenceRank; // 攻击方装备等级（可选）
  opponentEquipmentRank?: SequenceRank; // 防御方装备等级（可选）
  targetObjective?: string; // 当前场景目标
  committedResources: string[]; // 已投入资源/手段
  knownAdvantages: string[]; // 已知有利因素
  knownDisadvantages: string[]; // 已知不利因素
  riskTolerance: LOTMRiskTolerance;
  swing?: LOTMSwing;
}

// ===========================================================================
// 战斗交换输出
// ===========================================================================

export interface LOTMStateLanding {
  kind: LOTMStateLandingKind;
  required: boolean;
  reason: string;
}

export interface LOTMCombatExchangeResult {
  actorId: string;
  opponentId: string;
  intent: string;
  tactic: LOTMTactic;
  outcome: LOTMOutcomeBand;
  rankCheck: string; // 等级比较的叙述
  stateLandings: LOTMStateLanding[];
  consequenceGuidance: string[]; // 后果引导
  narrativeConstraints: string[]; // 叙事约束
  forbiddenNarration: string[]; // 禁止写法
  nextActionWindow: string; // 下一行动窗口
}

// ===========================================================================
// 主裁决函数
// ===========================================================================

export function resolveLOTMCombatExchange(
  _state: State,
  input: LOTMCombatExchangeInput,
): LOTMCombatExchangeResult {
  // 1. 等级比较
  const rankComparison = compareLOTMRanks(input.actorRank, input.opponentRank);
  const equipmentComparison = resolveEquipmentComparison(input);

  // 2. 综合等级差
  const combinedDelta = rankComparison.baselineTierDelta + equipmentComparison;

  // 3. 根据等级差和上下文裁决
  const outcome = determineLOTMOutcome(combinedDelta, input);

  // 4. 构建状态落点
  const stateLandings = buildLOTMStateLandings(input, outcome, combinedDelta);

  // 5. 构建后果引导、叙事约束、禁止写法
  const consequenceGuidance = buildLOTMConsequenceGuidance(outcome, input.swing);
  const narrativeConstraints = buildLOTMNarrativeConstraints(input, outcome, combinedDelta);
  const forbiddenNarration = buildLOTMForbiddenNarration(outcome);
  const nextActionWindow = buildLOTMNextActionWindow(input, outcome);

  return {
    actorId: input.actorId,
    opponentId: input.opponentId,
    intent: input.intent,
    tactic: input.tactic,
    outcome,
    rankCheck: formatLOTMRankCheck(input, rankComparison, equipmentComparison),
    stateLandings,
    consequenceGuidance,
    narrativeConstraints,
    forbiddenNarration,
    nextActionWindow,
  };
}

// ===========================================================================
// 装备等级比较
// ===========================================================================

function resolveEquipmentComparison(input: LOTMCombatExchangeInput): number {
  const actorEq = input.actorEquipmentRank;
  const opponentEq = input.opponentEquipmentRank;

  if (actorEq === undefined && opponentEq === undefined) return 0;
  if (actorEq === undefined) return -0.5; // 无装备 vs 有装备，小劣
  if (opponentEq === undefined) return 0.5; // 有装备 vs 无装备，小优

  const comparison = compareLOTMRanks(actorEq, opponentEq);
  // 装备等级差对综合等级的影响减半（装备是外部因素，不如自身等级重要）
  return comparison.baselineTierDelta * 0.5;
}

// ===========================================================================
// 判定结果
// ===========================================================================

function determineLOTMOutcome(
  combinedDelta: number,
  input: LOTMCombatExchangeInput,
): LOTMOutcomeBand {
  if (combinedDelta >= 2) {
    return input.riskTolerance === "high" || input.riskTolerance === "desperate"
      ? "advantage-with-cost"
      : "clean-advantage";
  }
  if (combinedDelta >= 0.5) {
    return "advantage-with-cost";
  }
  if (combinedDelta >= -0.5) {
    return "exchange";
  }
  if (combinedDelta >= -1.5) {
    return input.riskTolerance === "desperate" ? "failed-with-cost" : "forced-defense";
  }
  return "overwhelmed";
}

// ===========================================================================
// 状态落点
// ===========================================================================

function buildLOTMStateLandings(
  input: LOTMCombatExchangeInput,
  outcome: LOTMOutcomeBand,
  combinedDelta: number,
): LOTMStateLanding[] {
  const landings: LOTMStateLanding[] = [
    {
      kind: "scene-objective",
      required: true,
      reason:
        input.targetObjective === undefined
          ? `交锋必须说明「${input.intent}」推进、受阻或转化成哪个下一窗口。`
          : `交锋必须落到当前目标：${input.targetObjective}。`,
    },
  ];

  // 非干净优势 → 必须保留威胁
  if (outcome !== "clean-advantage") {
    landings.push({
      kind: "scene-threat",
      required: true,
      reason: "非无损优势必须保留威胁、距离压力或敌方下一手。",
    });
  }

  // 代价落点
  if (requiresCost(outcome, input.riskTolerance)) {
    landings.push({
      kind: "actor-condition",
      required: true,
      reason: "失利或绝境交锋需要伤势、疲劳、失控值提升、灵感消耗或其他可审计代价。",
    });
  } else if (input.riskTolerance === "high" || input.riskTolerance === "desperate") {
    landings.push({
      kind: "actor-condition",
      required: false,
      reason:
        "高风险代价可落在灵感消耗、失控值提升、暴露或消耗品；若已由位置或局势承接，可不写伤势。",
    });
  }

  // 装备落点
  if (input.tactic === "use-ability" && combinedDelta >= 0.5) {
    landings.push({
      kind: "equipment",
      required: true,
      reason: "超凡能力释放后，装备/封印物的消耗、副作用或使用限制必须落点。",
    });
  }

  // 记忆落点
  if (input.tactic === "use-ability") {
    landings.push({
      kind: "memory",
      required: true,
      reason: "超凡能力使用若被玩家确认，需要记忆记录。",
    });
    landings.push({
      kind: "reveal-secret",
      required: false,
      reason: "若能力名称、序列身份或隐藏能力从线索变成公开事实，必须走 reveal_secret。",
    });
  }

  return landings;
}

// ===========================================================================
// 辅助函数
// ===========================================================================

function requiresCost(outcome: LOTMOutcomeBand, riskTolerance: LOTMRiskTolerance): boolean {
  return (
    outcome === "forced-defense" ||
    outcome === "failed-with-cost" ||
    outcome === "overwhelmed" ||
    (outcome === "advantage-with-cost" && riskTolerance === "desperate")
  );
}

function buildLOTMConsequenceGuidance(
  outcome: LOTMOutcomeBand,
  swing: LOTMSwing | undefined,
): string[] {
  const guidance: string[] = [];
  switch (outcome) {
    case "clean-advantage":
      guidance.push("给出明确战果：位置、火线、阵型、距离或目标进度至少改变一项。");
      break;
    case "advantage-with-cost":
      guidance.push("战果要大于一句挡住：允许撕出通路、逼退一步或迫使敌方改手。");
      guidance.push("代价优先落到灵感、失控值、暴露或消耗品；不要默认每次都写伤势。");
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
  }
  if (swing === "opening" || swing === "turnabout") {
    guidance.push("有利变数可以打破单调等级压制，但只能兑现为局部窗口、资源交换或目标推进。");
  }
  if (swing === "bad-break" || swing === "pressure") {
    guidance.push("不利变数应扩大局势后果，而不是只把动作写成失败。");
  }
  return guidance;
}

function buildLOTMNarrativeConstraints(
  input: LOTMCombatExchangeInput,
  outcome: LOTMOutcomeBand,
  combinedDelta: number,
): string[] {
  const constraints = [
    "交锋裁决只覆盖当前交锋意图；不要借此直接写完整场战斗结束，除非当前目标就是终结战斗且状态落点已处理。",
    "结果必须落到位置、距离、伤势、灵感、失控值、目标推进、威胁变化或自然可接续的新局面；不要写成纯气势胜负。",
    "骰子或气氛不能覆盖序列等级压制、Locked Facts、身份/能力信息安全与已记录伤势。",
  ];

  if (combinedDelta >= 2) {
    constraints.push(
      "两级以上序列等级压制默认成立；低位方只能靠相性、环境、情报、牺牲资源或改换目标争取局部窗口。",
    );
  }

  if (combinedDelta >= 1) {
    constraints.push("一级序列等级优势明显；低位方需要更聪明的战术或意外因素来弥补差距。");
  }

  if (input.riskTolerance === "high" || input.riskTolerance === "desperate") {
    constraints.push(
      "高风险投入必须留下代价，但代价可落在灵感、失控值、暴露、位置或敌方下一手；不要每次都写伤势或停手。",
    );
  }

  if (outcome === "overwhelmed") {
    constraints.push(
      "被压制方不得正面赢下交换；只能保住局部目标、被迫退让、付出代价或等待新资源介入。",
    );
  }

  return constraints;
}

function buildLOTMForbiddenNarration(outcome: LOTMOutcomeBand): string[] {
  const forbidden = [
    "禁止输出 HP、伤害数字、DC、score 或内部字段。",
    "禁止把未揭示的身份、能力、弱点或幕后判断直接写进玩家视角。",
    "禁止把无资源投入的高风险行动写成免费成功。",
  ];
  if (outcome === "overwhelmed") {
    forbidden.push("禁止让被压制方靠决心、气势或一句台词正面反杀。");
  }
  return forbidden;
}

function buildLOTMNextActionWindow(
  input: LOTMCombatExchangeInput,
  outcome: LOTMOutcomeBand,
): string {
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
      return `「${input.intent}」失败且代价落下；推进到处理伤势/失控/暴露或请求援护的选择点。`;
    case "overwhelmed":
      return `「${input.intent}」遭到压制；推进到付出更高代价、利用环境相性、撤退或等待外部窗口的选择点。`;
    default:
      throw new Error("unreachable: all LOTMOutcomeBand cases covered");
  }
}

function formatLOTMRankCheck(
  input: LOTMCombatExchangeInput,
  rankComparison: LOTMRankComparison,
  equipmentComparison: number,
): string {
  const base = `${input.actorRank} vs ${input.opponentRank}: ${rankComparison.narrative}`;
  if (equipmentComparison !== 0) {
    const eqNote =
      equipmentComparison > 0
        ? `；装备等级带来 ${equipmentComparison.toFixed(1)} 级优势`
        : `；装备等级带来 ${equipmentComparison.toFixed(1)} 级劣势`;
    return base + eqNote;
  }
  return base;
}

// ===========================================================================
// 工具注册
// ===========================================================================

export const resolveLOTMCombatExchangeToolDefinition: FateToolDefinition = {
  name: "resolve_combat_exchange",
  description:
    "LOTM 战斗交换裁决。比较双方序列等级、装备等级和上下文因素，输出叙事约束和状态落点。\n\n" +
    "使用边界：一次明确的战斗交锋对抗。\n" +
    "禁区：一次结算完整战斗；输出 HP 或内部数值；把 outcome 当成自动状态变更。",
  parameters: Type.Object({
    actorId: Type.String({ description: "本方 actor id" }),
    opponentId: Type.String({ description: "主要对手 actor id" }),
    intent: Type.String({ description: "当前动作意图" }),
    tactic: Type.String({
      description:
        "direct-attack / defense / escape / protect / probe / break-restraint / use-ability / support",
    }),
    actorRank: Type.String({ description: "本方序列等级（如 seq-9, seq-5, seq-0, pillar）" }),
    opponentRank: Type.String({ description: "对手序列等级" }),
    actorEquipmentRank: Type.Optional(Type.String({ description: "本方装备等级（可选）" })),
    opponentEquipmentRank: Type.Optional(Type.String({ description: "对手装备等级（可选）" })),
    targetObjective: Type.Optional(Type.String({ description: "当前场景目标" })),
    committedResources: Type.Optional(
      Type.Array(Type.String({ description: "已投入的资源/手段" })),
    ),
    knownAdvantages: Type.Optional(Type.Array(Type.String({ description: "已知有利因素" }))),
    knownDisadvantages: Type.Optional(Type.Array(Type.String({ description: "已知不利因素" }))),
    riskTolerance: Type.String({ description: "low / medium / high / desperate" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    resolveLOTMCombatExchangeTool(params, ctx.sessionManager),
};

function resolveLOTMCombatExchangeTool(params: unknown, sessionManager: unknown): ToolResult {
  const input = parseLOTMCombatExchangeInput(params);
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      const result = resolveLOTMCombatExchange(draft, {
        ...input,
        swing: input.swing ?? rollLOTMSwing(draft),
      });
      const recorded = result.stateLandings
        .filter((l) => l.required)
        .map((l) =>
          recordObligation(draft, {
            source: "combat-exchange",
            kind: l.kind,
            summary: l.reason,
          }),
        );
      return { result, recordedObligations: recorded.length };
    },
    details: ({ result }) => ({ result }),
    message: ({ result, recordedObligations }) =>
      formatLOTMCombatExchangeResult(result, recordedObligations),
  });
}

// ===========================================================================
// 输入验证
// ===========================================================================

function parseLOTMCombatExchangeInput(params: unknown): LOTMCombatExchangeInput {
  const raw = isRecord(params) ? params : {};
  const actorId = typeof raw["actorId"] === "string" ? raw["actorId"] : "";
  const opponentId = typeof raw["opponentId"] === "string" ? raw["opponentId"] : "";
  if (!actorId) throw new Error("resolve_combat_exchange: 缺少 actorId。");
  if (!opponentId) throw new Error("resolve_combat_exchange: 缺少 opponentId。");

  const actorRank = typeof raw["actorRank"] === "string" ? raw["actorRank"] : "";
  const opponentRank = typeof raw["opponentRank"] === "string" ? raw["opponentRank"] : "";
  if (!actorRank) throw new Error("resolve_combat_exchange: 缺少 actorRank。");
  if (!opponentRank) throw new Error("resolve_combat_exchange: 缺少 opponentRank。");

  return {
    actorId,
    opponentId,
    intent: typeof raw["intent"] === "string" ? raw["intent"] : "",
    tactic: assertOneOfString(
      raw["tactic"],
      [
        "direct-attack",
        "defense",
        "escape",
        "protect",
        "probe",
        "break-restraint",
        "use-ability",
        "support",
      ],
      "tactic",
    ),
    actorRank: assertOneOfString(actorRank, SEQUENCE_RANKS, "actorRank"),
    opponentRank: assertOneOfString(opponentRank, SEQUENCE_RANKS, "opponentRank"),
    actorEquipmentRank: assertOptionalOneOfString(
      raw["actorEquipmentRank"],
      SEQUENCE_RANKS,
      "actorEquipmentRank",
    ),
    opponentEquipmentRank: assertOptionalOneOfString(
      raw["opponentEquipmentRank"],
      SEQUENCE_RANKS,
      "opponentEquipmentRank",
    ),
    targetObjective:
      typeof raw["targetObjective"] === "string" ? raw["targetObjective"] : undefined,
    committedResources: asStringArray(raw["committedResources"]),
    knownAdvantages: asStringArray(raw["knownAdvantages"]),
    knownDisadvantages: asStringArray(raw["knownDisadvantages"]),
    riskTolerance: assertOneOfString(
      raw["riskTolerance"],
      ["low", "medium", "high", "desperate"],
      "riskTolerance",
    ),
    swing: assertOptionalOneOfString(
      raw["swing"],
      ["bad-break", "pressure", "neutral", "opening", "turnabout"] as const,
      "swing",
    ),
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

// ===========================================================================
// Swing 骰子
// ===========================================================================

function rollLOTMSwing(state: State): LOTMSwing {
  const roll = seededRandomInt(state, 100);
  if (roll < 10) return "bad-break";
  if (roll < 30) return "pressure";
  if (roll < 70) return "neutral";
  if (roll < 90) return "opening";
  return "turnabout";
}

// ===========================================================================
// 结果格式化
// ===========================================================================

function formatLOTMCombatExchangeResult(
  result: LOTMCombatExchangeResult,
  recordedObligations: number,
): string {
  return [
    `交锋裁决：${result.outcome}`,
    `意图：${result.intent}`,
    `序列等级：${result.rankCheck}`,
    "",
    "状态落点：",
    ...result.stateLandings.map(formatLOTMStateLanding),
    "",
    "后果力度：",
    ...uniqueLines(result.consequenceGuidance).map((line) => `- ${line}`),
    "",
    "叙事约束：",
    ...uniqueLines([...result.narrativeConstraints, noNumberNarrativeHint()]).map(
      (line) => `- ${line}`,
    ),
    "",
    "禁止写法：",
    ...uniqueLines(result.forbiddenNarration).map((line) => `- ${line}`),
    "",
    `下一行动窗口：${result.nextActionWindow}`,
    ...(recordedObligations > 0
      ? [
          "",
          `⚠ 已登记 ${recordedObligations} 条必须落地的义务；本轮 canonical commit 前必须用对应状态事件清账。`,
        ]
      : []),
  ].join("\n");
}

function formatLOTMStateLanding(landing: LOTMStateLanding): string {
  const strength = landing.required ? "必须" : "可选";
  return `- ${strength} ${landing.kind}: ${landing.reason}`;
}

function uniqueLines(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      unique.push(trimmed);
    }
  }
  return unique;
}
