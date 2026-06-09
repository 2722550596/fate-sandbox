import { randomInt } from "node:crypto";

import {
  assertCombatExchangeInput,
  formatCombatSwing,
  resolveCombatExchange,
  type CombatExchangeResult,
  type CombatStateLanding,
  type CombatSwing,
  type RawCombatExchangeInput,
} from "../../engine/core/combat-exchange";
import { writeStateToDetails } from "../../engine/core/state";
import { noNumberNarrativeHint } from "../runtime/narrative-hints";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function resolveCombatExchangeTool(
  params: RawCombatExchangeInput,
  _sessionManager: unknown,
): ToolResult {
  const input = assertCombatExchangeInput(params);
  const result = resolveCombatExchange({ ...input, swing: input.swing ?? rollCombatSwing() });
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(formatCombatExchangeResult(result), details);
}

function formatCombatExchangeResult(result: CombatExchangeResult): string {
  return [
    `交锋裁决：${result.outcome}`,
    `意图：${result.intent}`,
    `参数/尺度：${result.rankCheck}`,
    `战场变数：${formatCombatSwing(result.swing)}`,
    "",
    "状态落点：",
    ...result.stateLandings.map(formatStateLanding),
    "",
    "后果力度：",
    ...uniqueLines(result.consequenceGuidance).map((line) => `- ${line}`),
    "",
    "叙事约束：",
    ...uniqueLines([...result.narrativeConstraints, noNumberNarrativeHint()]).map((line) => `- ${line}`),
    "",
    "禁止写法：",
    ...uniqueLines(result.forbiddenNarration).map((line) => `- ${line}`),
    "",
    `下一行动窗口：${result.nextActionWindow}`,
  ].join("\n");
}

function formatStateLanding(landing: CombatStateLanding): string {
  const strength = landing.required ? "必须" : "可选";
  return `- ${strength} ${landing.kind}: ${landing.reason}`;
}

function rollCombatSwing(): CombatSwing {
  const roll = randomInt(100);
  if (roll < 10) return "bad-break";
  if (roll < 30) return "pressure";
  if (roll < 70) return "neutral";
  if (roll < 90) return "opening";
  return "turnabout";
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
