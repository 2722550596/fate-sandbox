export interface PressureEffect {
  path: string;
  before: number | string;
  after: number | string;
  delta?: number;
  reason: string;
  narrativeHint: string;
}

export function noNumberPressureHint(): string {
  return "不要向玩家展示内部状态数值；只叙述可感知后果。";
}
