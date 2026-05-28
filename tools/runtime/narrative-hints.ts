import type { State } from "../../engine/core/state";

const NARRATIVE_NO_NUMBERS_HINT =
  "叙事提醒：以上数值只供 GM 内部结算；最终叙事禁止直接暴露百分比、数值、DC、骰点或字段名。请把它们翻译成感官、动作、环境压力与 NPC 反应。";

export function noNumberNarrativeHint(): string {
  return NARRATIVE_NO_NUMBERS_HINT;
}

export function formatPressureSummary(state: State): string {
  return [
    `身体 ${pressureBand(state.身体状态, "body")}`,
    `疲劳 ${pressureBand(state.疲劳, "pressure")}`,
    `魔力 ${pressureBand(state.魔力负担, "pressure")}`,
    `危险 ${dangerBand(state.危险度)}`,
  ].join("｜");
}

function pressureBand(value: number, kind: "body" | "pressure"): string {
  if (kind === "body") {
    if (value >= 80) return "稳定";
    if (value >= 50) return "受损";
    if (value >= 20) return "重创";
    return "濒危";
  }
  if (value < 20) return "低";
  if (value < 50) return "升高";
  if (value < 80) return "高";
  return "临界";
}

function dangerBand(value: number): string {
  if (value <= 1) return "低";
  if (value <= 3) return "危险";
  return "危急";
}
