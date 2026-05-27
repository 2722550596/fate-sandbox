import { assertCheckInput, resolveCheck, type RawCheckInput } from "../../engine/core/check";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function resolveCheckTool(params: RawCheckInput): ToolResult {
  const result = resolveCheck(assertCheckInput(params));
  const text = [
    "判定已结算：",
    `🎲 ${formatRolls(result.roll.rolls)}，保留 ${result.roll.kept}；修正 ${formatSigned(result.roll.modifier)}；总计 ${result.roll.total} vs DC ${result.roll.dc}`,
    `📌 结果: ${result.outcome}`,
    "",
    "机械后果：",
    ...result.effects.map((effect) => `- ${effect.reason}: ${formatValueChange(effect.before, effect.after, effect.delta)}`),
    "",
    "叙事约束：",
    ...uniqueHints(result.effects.map((effect) => effect.narrativeHint), result.narrativeConstraints).map((hint) => `- ${hint}`),
  ].join("\n");

  const details: Record<string, unknown> = {};
  writeStateToDetails(details);
  return textResult(text, details);
}

function formatRolls(rolls: number[]): string {
  return rolls.join(" / ");
}

function formatSigned(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value}`;
}

function formatValueChange(before: number | string, after: number | string, delta: number | undefined): string {
  return `${String(before)} → ${String(after)}${formatDelta(delta)}`;
}

function formatDelta(delta: number | undefined): string {
  if (delta === undefined) {
    return "";
  }
  return formatSigned(delta).replace(/^/, " (") + ")";
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
