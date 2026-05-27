import { assertConsequenceInput, resolveConsequence, type RawConsequenceInput } from "../../engine/core/consequence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function resolveConsequenceTool(params: RawConsequenceInput): ToolResult {
  const result = resolveConsequence(assertConsequenceInput(params));
  const text = [
    "后果已结算：",
    ...result.effects.map((effect) => `- ${effect.reason}: ${formatValueChange(effect.before, effect.after, effect.delta)}`),
    "",
    `当前压力：身体 ${result.after.身体状态}｜疲劳 ${result.after.疲劳}｜魔力 ${result.after.魔力负担}｜危险 ${result.after.危险度}/5｜神秘 ${result.after.神秘暴露}｜社会 ${result.after.社会暴露}｜敌警 ${result.after.敌方警觉}`,
    "",
    "叙事约束：",
    ...uniqueHints(result.effects.map((effect) => effect.narrativeHint), result.narrativeConstraints).map((hint) => `- ${hint}`),
  ].join("\n");

  const details: Record<string, unknown> = {};
  writeStateToDetails(details);
  return textResult(text, details);
}

function formatValueChange(before: number | string, after: number | string, delta: number | undefined): string {
  return `${String(before)} → ${String(after)}${formatDelta(delta)}`;
}

function formatDelta(delta: number | undefined): string {
  if (delta === undefined) {
    return "";
  }
  const sign = delta >= 0 ? "+" : "";
  return ` (${sign}${delta})`;
}

function uniqueHints(primary: string[], secondary: string[]): string[] {
  const seen = new Set<string>();
  const hints: string[] = [];
  for (const hint of [...primary, ...secondary]) {
    const normalized = hint.trim();
    if (normalized.length > 0 && !seen.has(normalized)) {
      seen.add(normalized);
      hints.push(normalized);
    }
  }
  return hints;
}
