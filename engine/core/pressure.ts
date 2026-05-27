import type { State, StatePatchPath } from "./state";

export interface StatEffect {
  path: StatePatchPath;
  before: number | string;
  after: number | string;
  delta?: number;
  reason: string;
  narrativeHint: string;
}

const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const MIN_DANGER_LEVEL = 0;
const MAX_DANGER_LEVEL = 5;

export function advanceTime(state: State, minutes: number, reason: string): StatEffect {
  const beforeTime = state.当前时间;
  const beforeElapsed = state.经过分钟;
  state.当前时间 = advanceIsoTime(state.当前时间, minutes);
  state.经过分钟 += minutes;
  return {
    path: "/经过分钟",
    before: beforeElapsed,
    after: state.经过分钟,
    delta: minutes,
    reason,
    narrativeHint: `时间流逝了 ${minutes} 分钟：${beforeTime} → ${state.当前时间}。`,
  };
}

export function adjustMoney(state: State, amount: number, reason: string): StatEffect {
  const before = state.金钱;
  state.金钱 = Math.max(0, state.金钱 + amount);
  return createNumericEffect(
    "/金钱",
    before,
    state.金钱,
    reason,
    amount >= 0 ? "资金增加必须有来源。" : "消费必须体现在叙事动作里。",
  );
}

export function adjustBody(state: State, amount: number, reason: string): StatEffect {
  const before = state.身体状态;
  state.身体状态 = clampPercent(state.身体状态 + amount);
  return createNumericEffect(
    "/身体状态",
    before,
    state.身体状态,
    reason,
    amount >= 0 ? "身体有所恢复，但不能写成立刻完全无伤。" : "伤势必须影响行动、疼痛或判断。",
  );
}

export function adjustFatigue(state: State, amount: number, reason: string): StatEffect {
  const before = state.疲劳;
  state.疲劳 = clampPercent(state.疲劳 + amount);
  return createNumericEffect(
    "/疲劳",
    before,
    state.疲劳,
    reason,
    amount >= 0 ? "必须体现疲劳、迟滞、疼痛或注意力下降。" : "疲劳下降了，但时间已经流逝。",
  );
}

export function adjustManaStrain(state: State, amount: number, reason: string): StatEffect {
  const before = state.魔力负担;
  state.魔力负担 = clampPercent(state.魔力负担 + amount);
  return createNumericEffect(
    "/魔力负担",
    before,
    state.魔力负担,
    reason,
    amount >= 0
      ? "必须体现魔术回路或供魔压力，禁止把神秘当免费资源。"
      : "魔力负担缓和了，但不能抹去此前代价。",
  );
}

export function setDangerLevel(state: State, level: number, reason: string): StatEffect {
  const before = state.危险度;
  state.危险度 = clampDanger(level);
  return createNumericEffect(
    "/危险度",
    before,
    state.危险度,
    reason,
    state.危险度 >= 3 ? "当前场景不能写成完全安全。" : "危险暂时下降，但不是世界停止行动。",
  );
}

export function adjustMysteryExposure(state: State, amount: number, reason: string): StatEffect {
  const before = state.神秘暴露;
  state.神秘暴露 = clampPercent(state.神秘暴露 + amount);
  return createNumericEffect(
    "/神秘暴露",
    before,
    state.神秘暴露,
    reason,
    amount >= 0 ? "必须暗示神秘侧痕迹，禁止断言绝对没人察觉。" : "神秘痕迹被压低，但不能凭空消失。",
  );
}

export function adjustSocialExposure(state: State, amount: number, reason: string): StatEffect {
  const before = state.社会暴露;
  state.社会暴露 = clampPercent(state.社会暴露 + amount);
  return createNumericEffect(
    "/社会暴露",
    before,
    state.社会暴露,
    reason,
    amount >= 0
      ? "必须体现目击、记录、传闻或善后压力。"
      : "普通社会痕迹被处理，但会消耗时间或资源。",
  );
}

export function adjustEnemyAlert(state: State, amount: number, reason: string): StatEffect {
  const before = state.敌方警觉;
  state.敌方警觉 = clampPercent(state.敌方警觉 + amount);
  return createNumericEffect(
    "/敌方警觉",
    before,
    state.敌方警觉,
    reason,
    amount >= 0
      ? "敌对势力会在自己的时间线里行动。"
      : "敌方注意被误导或降温，但不会忘记已发生的异常。",
  );
}

export function pressureThresholdHints(state: State): string[] {
  const hints: string[] = [];
  pushThresholdHint(
    hints,
    state.疲劳,
    50,
    80,
    "疲劳",
    "动作迟缓、判断变差",
    "高强度行动可能造成身体损伤",
  );
  pushThresholdHint(
    hints,
    state.魔力负担,
    50,
    80,
    "魔力负担",
    "魔术回路灼痛、精密操作困难",
    "继续施法可能烧毁回路或昏迷",
  );
  pushThresholdHint(
    hints,
    state.神秘暴露,
    50,
    80,
    "神秘暴露",
    "魔术侧可能注意到痕迹",
    "敌对魔术师或监管势力可能主动介入",
  );
  pushThresholdHint(
    hints,
    state.社会暴露,
    50,
    80,
    "社会暴露",
    "普通社会开始留下记录/传闻",
    "警察、学校、医院或媒体压力可能主动出现",
  );
  pushThresholdHint(
    hints,
    state.敌方警觉,
    50,
    80,
    "敌方警觉",
    "敌人开始主动调查",
    "敌人可能设伏、追踪或抢先行动",
  );
  if (state.危险度 >= 4) {
    hints.push("危险度 ≥ 4：本场必须保留即时威胁，不能用安稳收束。 ");
  }
  if (state.身体状态 <= 50) {
    hints.push("身体状态 ≤ 50：伤势显著影响行动，不能正常发挥。 ");
  }
  if (state.身体状态 <= 20) {
    hints.push("身体状态 ≤ 20：濒危状态，继续行动必须付出严重代价。 ");
  }
  return hints;
}

function createNumericEffect(
  path: StatePatchPath,
  before: number,
  after: number,
  reason: string,
  narrativeHint: string,
): StatEffect {
  return { path, before, after, delta: after - before, reason, narrativeHint };
}

function pushThresholdHint(
  hints: string[],
  value: number,
  warning: number,
  crisis: number,
  label: string,
  warningHint: string,
  crisisHint: string,
): void {
  if (value >= crisis) {
    hints.push(`${label} ≥ ${crisis}：${crisisHint}。`);
    return;
  }
  if (value >= warning) {
    hints.push(`${label} ≥ ${warning}：${warningHint}。`);
  }
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
