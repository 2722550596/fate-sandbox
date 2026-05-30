import type { State } from "../../engine/core/state";

export function formatPressureSummary(_state: State): string {
  return "Fate 领域状态已启用：伤势、魔力、危险以 actor/scene/memory 表达。";
}

export function noNumberNarrativeHint(): string {
  return "不要向玩家展示内部数值或 schema 字段；只叙述可感知事实与后果。";
}
