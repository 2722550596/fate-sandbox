import {
  adjustBody,
  adjustEnemyAlert,
  adjustFatigue,
  adjustManaStrain,
  adjustMysteryExposure,
  adjustSocialExposure,
  advanceTime,
  pressureThresholdHints,
  type StatEffect,
} from "./pressure";
import { cloneState, patchState, type PatchOp, type State } from "./state";

export type CheckKind = "体能" | "隐匿" | "调查" | "社交" | "魔术" | "战斗";
export type CheckDifficulty = "简单" | "普通" | "困难" | "极难" | "不可能";
export type CheckAdvantage = "劣势" | "正常" | "优势";
export type CheckRisk = "低" | "中" | "高" | "致命";
export type CheckConsequence = "疲劳" | "受伤" | "魔力负担" | "神秘暴露" | "社会暴露" | "敌方警觉";
export type CheckOutcome = "大成功" | "成功" | "代价成功" | "失败" | "严重失败";

export interface CheckInput {
  判定类型: CheckKind;
  难度: CheckDifficulty;
  优势: CheckAdvantage;
  风险等级: CheckRisk;
  失败后果: CheckConsequence;
  预计耗时分钟: number;
}

export interface RawCheckInput {
  判定类型: unknown;
  难度: unknown;
  优势: unknown;
  风险等级: unknown;
  失败后果: unknown;
  预计耗时分钟: unknown;
}

export interface CheckRoll {
  kept: number;
  rolls: number[];
  modifier: number;
  dc: number;
  total: number;
}

export interface CheckResult {
  before: State;
  after: State;
  input: CheckInput;
  roll: CheckRoll;
  outcome: CheckOutcome;
  effects: StatEffect[];
  narrativeConstraints: string[];
}

interface ModifierEntry {
  amount: number;
  reason: string;
}

const MAX_CHECK_MINUTES = 720;

export function resolveCheck(input: CheckInput): CheckResult {
  const before = cloneState();
  const after = cloneState();
  const modifierEntries = buildModifierEntries(before, input.判定类型);
  const modifier = modifierEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const rolls = rollD20(input.优势);
  const kept = keepRoll(rolls, input.优势);
  const dc = difficultyDc(input.难度);
  const total = kept + modifier;
  const outcome = decideOutcome(total, dc);
  const effects = applyCheckEffects(after, input, outcome);
  patchState(toPatchOps(after));

  return {
    before,
    after,
    input,
    roll: { kept, rolls, modifier, dc, total },
    outcome,
    effects,
    narrativeConstraints: buildNarrativeConstraints(
      input,
      outcome,
      modifierEntries,
      effects,
      after,
    ),
  };
}

export function assertCheckInput(raw: RawCheckInput): CheckInput {
  return {
    判定类型: assertKind(raw.判定类型),
    难度: assertDifficulty(raw.难度),
    优势: assertAdvantage(raw.优势),
    风险等级: assertRisk(raw.风险等级),
    失败后果: assertConsequence(raw.失败后果),
    预计耗时分钟: assertDuration(raw.预计耗时分钟),
  };
}

function applyCheckEffects(state: State, input: CheckInput, outcome: CheckOutcome): StatEffect[] {
  const severity = outcomeSeverity(outcome);
  const risk = riskSeverity(input.风险等级);
  const basePressure = Math.max(0, severity + risk - 1);
  const timePressure = Math.floor(input.预计耗时分钟 / 120);
  const effects: StatEffect[] = [advanceTime(state, input.预计耗时分钟, "判定耗时")];

  if (outcome === "大成功") {
    effects.push(adjustEnemyAlert(state, -Math.min(4, 1 + risk), "大成功压低敌方注意"));
    return compactEffects(effects);
  }

  if (outcome === "成功") {
    effects.push(adjustFatigue(state, Math.max(0, risk - 1), "成功行动的最低负荷"));
    effects.push(adjustEnemyAlert(state, timePressure, "行动期间局势推进"));
    return compactEffects(effects);
  }

  if (outcome === "代价成功") {
    effects.push(adjustFatigue(state, 2 + risk, "代价成功的身体负荷"));
    effects.push(
      applyPrimaryConsequence(
        state,
        input.失败后果,
        Math.max(2, basePressure),
        "代价成功的主要代价",
      ),
    );
    effects.push(adjustEnemyAlert(state, 1 + risk + timePressure, "代价成功留下破绽"));
    return compactEffects(effects);
  }

  if (outcome === "失败") {
    effects.push(adjustFatigue(state, 3 + risk, "失败后的额外负荷"));
    effects.push(
      applyPrimaryConsequence(state, input.失败后果, Math.max(4, basePressure + 2), "失败后果"),
    );
    effects.push(adjustEnemyAlert(state, 2 + risk + timePressure, "失败暴露行动意图"));
    return compactEffects(effects);
  }

  effects.push(adjustFatigue(state, 5 + risk, "严重失败造成的透支"));
  effects.push(
    applyPrimaryConsequence(state, input.失败后果, Math.max(7, basePressure + 4), "严重失败后果"),
  );
  effects.push(adjustEnemyAlert(state, 4 + risk * 2 + timePressure, "严重失败引发敌方主动反应"));
  return compactEffects(effects);
}

function applyPrimaryConsequence(
  state: State,
  consequence: CheckConsequence,
  amount: number,
  reason: string,
): StatEffect {
  switch (consequence) {
    case "疲劳":
      return adjustFatigue(state, amount, reason);
    case "受伤":
      return adjustBody(state, -amount, reason);
    case "魔力负担":
      return adjustManaStrain(state, amount, reason);
    case "神秘暴露":
      return adjustMysteryExposure(state, amount, reason);
    case "社会暴露":
      return adjustSocialExposure(state, amount, reason);
    case "敌方警觉":
      return adjustEnemyAlert(state, amount, reason);
    default: {
      const exhaustive: never = consequence;
      throw new Error(`未处理的失败后果: ${String(exhaustive)}`);
    }
  }
}

function buildModifierEntries(state: State, kind: CheckKind): ModifierEntry[] {
  const entries: ModifierEntry[] = [];
  if ((kind === "体能" || kind === "隐匿" || kind === "战斗") && state.疲劳 >= 50) {
    entries.push({ amount: -2, reason: "疲劳 ≥ 50" });
  }
  if ((kind === "体能" || kind === "隐匿" || kind === "战斗") && state.疲劳 >= 80) {
    entries.push({ amount: -3, reason: "疲劳 ≥ 80" });
  }
  if ((kind === "体能" || kind === "战斗") && state.身体状态 <= 50) {
    entries.push({ amount: -2, reason: "身体状态 ≤ 50" });
  }
  if ((kind === "体能" || kind === "战斗") && state.身体状态 <= 20) {
    entries.push({ amount: -4, reason: "身体状态 ≤ 20" });
  }
  if (kind === "魔术" && state.魔力负担 >= 50) {
    entries.push({ amount: -2, reason: "魔力负担 ≥ 50" });
  }
  if (kind === "魔术" && state.魔力负担 >= 80) {
    entries.push({ amount: -3, reason: "魔力负担 ≥ 80" });
  }
  if ((kind === "隐匿" || kind === "调查") && state.敌方警觉 >= 80) {
    entries.push({ amount: -2, reason: "敌方警觉 ≥ 80" });
  }
  return entries;
}

function buildNarrativeConstraints(
  input: CheckInput,
  outcome: CheckOutcome,
  modifierEntries: ModifierEntry[],
  effects: StatEffect[],
  after: State,
): string[] {
  const constraints = [
    `判定结果是「${outcome}」；必须按结果叙事，禁止改写成更乐观的结果。`,
    ...effects.map((effect) => `${effect.reason}: ${effect.narrativeHint}`),
    ...pressureThresholdHints(after),
  ];

  if (modifierEntries.length > 0) {
    constraints.push(
      `状态修正已生效：${modifierEntries.map((entry) => `${entry.reason} ${entry.amount}`).join("；")}。`,
    );
  }
  if (outcome === "代价成功") {
    constraints.push("目标可以达成，但必须明确留下代价或新麻烦。 ");
  }
  if (outcome === "失败" || outcome === "严重失败") {
    constraints.push("失败必须推进场景，不能回滚、卡住或用温柔兜底抵消。 ");
  }
  if (outcome === "严重失败") {
    constraints.push("严重失败必须带来可见损失、暴露、受伤或敌方先手。 ");
  }
  if (input.难度 === "不可能" && outcome !== "大成功") {
    constraints.push("不可能难度只有大成功才能打开极窄机会；其他结果不得写成正面突破。 ");
  }
  return constraints;
}

function decideOutcome(total: number, dc: number): CheckOutcome {
  const margin = total - dc;
  if (margin >= 10) {
    return "大成功";
  }
  if (margin >= 0) {
    return "成功";
  }
  if (margin >= -5) {
    return "代价成功";
  }
  if (margin >= -10) {
    return "失败";
  }
  return "严重失败";
}

function rollD20(advantage: CheckAdvantage): number[] {
  if (advantage === "正常") {
    return [randomD20()];
  }
  return [randomD20(), randomD20()];
}

function keepRoll(rolls: number[], advantage: CheckAdvantage): number {
  if (rolls.length === 1) {
    const roll = rolls[0];
    if (roll === undefined) {
      throw new Error("掷骰失败：没有骰值。");
    }
    return roll;
  }
  return advantage === "优势" ? Math.max(...rolls) : Math.min(...rolls);
}

function randomD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

function difficultyDc(difficulty: CheckDifficulty): number {
  switch (difficulty) {
    case "简单":
      return 8;
    case "普通":
      return 12;
    case "困难":
      return 16;
    case "极难":
      return 20;
    case "不可能":
      return 25;
    default: {
      const exhaustive: never = difficulty;
      throw new Error(`未处理的难度: ${String(exhaustive)}`);
    }
  }
}

function outcomeSeverity(outcome: CheckOutcome): number {
  switch (outcome) {
    case "大成功":
      return -1;
    case "成功":
      return 0;
    case "代价成功":
      return 2;
    case "失败":
      return 4;
    case "严重失败":
      return 7;
    default: {
      const exhaustive: never = outcome;
      throw new Error(`未处理的判定结果: ${String(exhaustive)}`);
    }
  }
}

function riskSeverity(risk: CheckRisk): number {
  switch (risk) {
    case "低":
      return 1;
    case "中":
      return 2;
    case "高":
      return 4;
    case "致命":
      return 7;
    default: {
      const exhaustive: never = risk;
      throw new Error(`未处理的风险等级: ${String(exhaustive)}`);
    }
  }
}

function compactEffects(effects: StatEffect[]): StatEffect[] {
  return effects.filter((effect) => effect.before !== effect.after);
}

function toPatchOps(state: State): PatchOp[] {
  return [
    { op: "replace", path: "/当前时间", value: state.当前时间 },
    { op: "replace", path: "/经过分钟", value: state.经过分钟 },
    { op: "replace", path: "/身体状态", value: state.身体状态 },
    { op: "replace", path: "/疲劳", value: state.疲劳 },
    { op: "replace", path: "/魔力负担", value: state.魔力负担 },
    { op: "replace", path: "/危险度", value: state.危险度 },
    { op: "replace", path: "/神秘暴露", value: state.神秘暴露 },
    { op: "replace", path: "/社会暴露", value: state.社会暴露 },
    { op: "replace", path: "/敌方警觉", value: state.敌方警觉 },
  ];
}

function assertKind(value: unknown): CheckKind {
  if (
    value === "体能" ||
    value === "隐匿" ||
    value === "调查" ||
    value === "社交" ||
    value === "魔术" ||
    value === "战斗"
  ) {
    return value;
  }
  throw new Error(`非法判定类型: ${formatUnknown(value)}。可选: 体能/隐匿/调查/社交/魔术/战斗。`);
}

function assertDifficulty(value: unknown): CheckDifficulty {
  if (
    value === "简单" ||
    value === "普通" ||
    value === "困难" ||
    value === "极难" ||
    value === "不可能"
  ) {
    return value;
  }
  throw new Error(`非法难度: ${formatUnknown(value)}。可选: 简单/普通/困难/极难/不可能。`);
}

function assertAdvantage(value: unknown): CheckAdvantage {
  if (value === "劣势" || value === "正常" || value === "优势") {
    return value;
  }
  throw new Error(`非法优势: ${formatUnknown(value)}。可选: 劣势/正常/优势。`);
}

function assertRisk(value: unknown): CheckRisk {
  if (value === "低" || value === "中" || value === "高" || value === "致命") {
    return value;
  }
  throw new Error(`非法风险等级: ${formatUnknown(value)}。可选: 低/中/高/致命。`);
}

function assertConsequence(value: unknown): CheckConsequence {
  if (
    value === "疲劳" ||
    value === "受伤" ||
    value === "魔力负担" ||
    value === "神秘暴露" ||
    value === "社会暴露" ||
    value === "敌方警觉"
  ) {
    return value;
  }
  throw new Error(
    `非法失败后果: ${formatUnknown(value)}。可选: 疲劳/受伤/魔力负担/神秘暴露/社会暴露/敌方警觉。`,
  );
}

function assertDuration(value: unknown): number {
  const duration = coerceInteger(value, "预计耗时分钟");
  if (duration < 0 || duration > MAX_CHECK_MINUTES) {
    throw new Error(`非法预计耗时分钟: ${duration}。必须在 0-${MAX_CHECK_MINUTES} 之间。`);
  }
  return duration;
}

function coerceInteger(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
  }
  throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是整数或整数字符串。`);
}

function formatUnknown(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  if (value === undefined) {
    return "undefined";
  }
  return Object.prototype.toString.call(value);
}
