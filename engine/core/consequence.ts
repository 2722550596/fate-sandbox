import { cloneState, patchState, type PatchOp, type State } from "./state";

export type ConsequenceAction =
  | "移动"
  | "调查"
  | "社交"
  | "潜入"
  | "战斗"
  | "魔术"
  | "逃跑"
  | "休息";
export type ConsequenceRisk = "低" | "中" | "高" | "致命";

export interface ConsequenceInput {
  行动类型: ConsequenceAction;
  风险等级: ConsequenceRisk;
  预计耗时分钟: number;
  是否公开: boolean;
  是否涉及神秘: boolean;
}

export interface RawConsequenceInput {
  行动类型: unknown;
  风险等级: unknown;
  预计耗时分钟: unknown;
  是否公开: unknown;
  是否涉及神秘: unknown;
}

export interface ConsequenceDelta {
  经过分钟: number;
  疲劳: number;
  魔力负担: number;
  危险度: number;
  神秘暴露: number;
  社会暴露: number;
  敌方警觉: number;
}

export interface ConsequenceResult {
  before: State;
  after: State;
  delta: ConsequenceDelta;
  narrativeConstraints: string[];
}

const MAX_PERCENT = 100;
const MIN_PERCENT = 0;
const MAX_DANGER_LEVEL = 5;
const MIN_DANGER_LEVEL = 0;
const MAX_ACTION_MINUTES = 1440;

export function resolveConsequence(input: ConsequenceInput): ConsequenceResult {
  const before = cloneState();
  const delta = calculateDelta(input);
  const after = applyConsequenceDelta(before, delta);
  patchState(toPatchOps(after));

  return {
    before,
    after,
    delta: calculateActualDelta(before, after),
    narrativeConstraints: buildNarrativeConstraints(input, before, after),
  };
}

export function assertConsequenceInput(raw: RawConsequenceInput): ConsequenceInput {
  return {
    行动类型: assertAction(raw.行动类型),
    风险等级: assertRisk(raw.风险等级),
    预计耗时分钟: assertDuration(raw.预计耗时分钟),
    是否公开: assertBoolean(raw.是否公开, "是否公开"),
    是否涉及神秘: assertBoolean(raw.是否涉及神秘, "是否涉及神秘"),
  };
}

function calculateDelta(input: ConsequenceInput): ConsequenceDelta {
  const base = baseDelta(input.行动类型);
  const risk = riskDelta(input.风险等级);
  const publicDelta = input.是否公开 ? 8 : 0;
  const mysteryDelta = input.是否涉及神秘 ? 16 : 0;
  const durationFatigue = Math.floor(input.预计耗时分钟 / 45);
  const durationAlert = Math.floor(input.预计耗时分钟 / 90);

  return {
    经过分钟: input.预计耗时分钟,
    疲劳: base.疲劳 + risk.疲劳 + durationFatigue,
    魔力负担: base.魔力负担 + (input.是否涉及神秘 ? risk.魔力负担 : 0),
    危险度: Math.max(base.危险度, risk.危险度),
    神秘暴露: base.神秘暴露 + mysteryDelta + (input.是否涉及神秘 ? risk.神秘暴露 : 0),
    社会暴露: base.社会暴露 + publicDelta + (input.是否公开 ? risk.社会暴露 : 0),
    敌方警觉: base.敌方警觉 + risk.敌方警觉 + durationAlert + (input.是否涉及神秘 ? 6 : 0),
  };
}

function baseDelta(action: ConsequenceAction): ConsequenceDelta {
  switch (action) {
    case "移动":
      return createDelta({ 疲劳: 3, 危险度: 1, 社会暴露: 2 });
    case "调查":
      return createDelta({ 疲劳: 5, 危险度: 2, 社会暴露: 4, 敌方警觉: 3 });
    case "社交":
      return createDelta({ 疲劳: 2, 危险度: 1, 社会暴露: 5, 敌方警觉: 2 });
    case "潜入":
      return createDelta({ 疲劳: 8, 危险度: 3, 社会暴露: 6, 敌方警觉: 8 });
    case "战斗":
      return createDelta({
        疲劳: 15,
        魔力负担: 8,
        危险度: 4,
        神秘暴露: 8,
        社会暴露: 10,
        敌方警觉: 18,
      });
    case "魔术":
      return createDelta({ 疲劳: 6, 魔力负担: 15, 危险度: 3, 神秘暴露: 18, 敌方警觉: 10 });
    case "逃跑":
      return createDelta({ 疲劳: 12, 危险度: 3, 社会暴露: 8, 敌方警觉: 8 });
    case "休息":
      return createDelta({ 疲劳: -16, 魔力负担: -8, 危险度: 0, 敌方警觉: 2 });
    default: {
      const exhaustive: never = action;
      throw new Error(`未处理的行动类型: ${String(exhaustive)}`);
    }
  }
}

function riskDelta(risk: ConsequenceRisk): ConsequenceDelta {
  switch (risk) {
    case "低":
      return createDelta({ 疲劳: 1, 危险度: 1, 敌方警觉: 1 });
    case "中":
      return createDelta({
        疲劳: 3,
        魔力负担: 2,
        危险度: 2,
        神秘暴露: 3,
        社会暴露: 3,
        敌方警觉: 5,
      });
    case "高":
      return createDelta({
        疲劳: 6,
        魔力负担: 5,
        危险度: 4,
        神秘暴露: 8,
        社会暴露: 8,
        敌方警觉: 12,
      });
    case "致命":
      return createDelta({
        疲劳: 12,
        魔力负担: 10,
        危险度: 5,
        神秘暴露: 15,
        社会暴露: 12,
        敌方警觉: 22,
      });
    default: {
      const exhaustive: never = risk;
      throw new Error(`未处理的风险等级: ${String(exhaustive)}`);
    }
  }
}

function createDelta(overrides: Partial<ConsequenceDelta>): ConsequenceDelta {
  return {
    经过分钟: 0,
    疲劳: 0,
    魔力负担: 0,
    危险度: 0,
    神秘暴露: 0,
    社会暴露: 0,
    敌方警觉: 0,
    ...overrides,
  };
}

function applyConsequenceDelta(state: State, delta: ConsequenceDelta): State {
  const elapsedMinutes = state.经过分钟 + delta.经过分钟;
  return {
    ...state,
    当前时间: advanceIsoTime(state.当前时间, delta.经过分钟),
    经过分钟: elapsedMinutes,
    疲劳: clampPercent(state.疲劳 + delta.疲劳),
    魔力负担: clampPercent(state.魔力负担 + delta.魔力负担),
    危险度: clampDanger(delta.危险度),
    神秘暴露: clampPercent(state.神秘暴露 + delta.神秘暴露),
    社会暴露: clampPercent(state.社会暴露 + delta.社会暴露),
    敌方警觉: clampPercent(state.敌方警觉 + delta.敌方警觉),
  };
}

function calculateActualDelta(before: State, after: State): ConsequenceDelta {
  return {
    经过分钟: after.经过分钟 - before.经过分钟,
    疲劳: after.疲劳 - before.疲劳,
    魔力负担: after.魔力负担 - before.魔力负担,
    危险度: after.危险度 - before.危险度,
    神秘暴露: after.神秘暴露 - before.神秘暴露,
    社会暴露: after.社会暴露 - before.社会暴露,
    敌方警觉: after.敌方警觉 - before.敌方警觉,
  };
}

function toPatchOps(state: State): PatchOp[] {
  return [
    { op: "replace", path: "/当前时间", value: state.当前时间 },
    { op: "replace", path: "/经过分钟", value: state.经过分钟 },
    { op: "replace", path: "/疲劳", value: state.疲劳 },
    { op: "replace", path: "/魔力负担", value: state.魔力负担 },
    { op: "replace", path: "/危险度", value: state.危险度 },
    { op: "replace", path: "/神秘暴露", value: state.神秘暴露 },
    { op: "replace", path: "/社会暴露", value: state.社会暴露 },
    { op: "replace", path: "/敌方警觉", value: state.敌方警觉 },
  ];
}

function buildNarrativeConstraints(input: ConsequenceInput, before: State, after: State): string[] {
  const constraints = [
    `必须表现时间流逝：${before.当前时间} → ${after.当前时间}`,
    "必须描写至少一个具体代价，禁止写成毫无后果。",
  ];

  if (after.疲劳 > before.疲劳) {
    constraints.push("必须体现疲劳、迟滞、疼痛或注意力下降。只有休息或治疗才能抹平。");
  }
  if (after.魔力负担 > before.魔力负担) {
    constraints.push("必须体现魔力负担；禁止把魔术/供魔写成免费资源。");
  }
  if (after.神秘暴露 > before.神秘暴露) {
    constraints.push(
      "必须暗示神秘侧可能留下痕迹；禁止断言绝对没人察觉。触及具体预设势力前先 lookup。 ",
    );
  }
  if (after.社会暴露 > before.社会暴露) {
    constraints.push("必须体现普通社会层面的目击、记录、传闻或善后压力。 ");
  }
  if (after.敌方警觉 > before.敌方警觉) {
    constraints.push("敌方警觉已上升；NPC/敌对势力会在自己的时间线里行动，不能写成完全安全。 ");
  }
  if (input.风险等级 === "高" || input.风险等级 === "致命") {
    constraints.push("高风险行动不能被一句话、善意或临场觉悟轻易化解。 ");
  }

  return constraints;
}

function advanceIsoTime(isoTime: string, minutes: number): string {
  const timestamp = Date.parse(isoTime);
  if (Number.isNaN(timestamp)) {
    throw new Error(`无法推进非法时间: ${isoTime}`);
  }
  return new Date(timestamp + minutes * 60_000).toISOString();
}

function clampPercent(value: number): number {
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));
}

function clampDanger(value: number): number {
  return Math.min(MAX_DANGER_LEVEL, Math.max(MIN_DANGER_LEVEL, value));
}

function assertAction(value: unknown): ConsequenceAction {
  if (
    value === "移动" ||
    value === "调查" ||
    value === "社交" ||
    value === "潜入" ||
    value === "战斗" ||
    value === "魔术" ||
    value === "逃跑" ||
    value === "休息"
  ) {
    return value;
  }
  throw new Error(
    `非法行动类型: ${formatUnknown(value)}。可选: 移动/调查/社交/潜入/战斗/魔术/逃跑/休息。`,
  );
}

function assertRisk(value: unknown): ConsequenceRisk {
  if (value === "低" || value === "中" || value === "高" || value === "致命") {
    return value;
  }
  throw new Error(`非法风险等级: ${formatUnknown(value)}。可选: 低/中/高/致命。`);
}

function assertDuration(value: unknown): number {
  const duration = coerceInteger(value, "预计耗时分钟");
  if (duration < 0 || duration > MAX_ACTION_MINUTES) {
    throw new Error(`非法预计耗时分钟: ${duration}。必须在 0-${MAX_ACTION_MINUTES} 之间。`);
  }
  return duration;
}

function assertBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是 boolean。`);
  }
  return value;
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
