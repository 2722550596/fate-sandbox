import {
  assertCombatExchangeInput,
  resolveCombatExchange,
  type CombatExchangeResult,
  type CombatStateLanding,
  type RawCombatExchangeInput,
} from "../../engine/core/combat-exchange";
import { writeStateToDetails } from "../../engine/core/state";
import { noNumberNarrativeHint } from "../runtime/narrative-hints";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function resolveCombatExchangeTool(
  params: RawCombatExchangeInput,
  _sessionManager: unknown,
): ToolResult {
  const result = resolveCombatExchange(assertCombatExchangeInput(params));
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(formatCombatExchangeResult(result), details);
}

function formatCombatExchangeResult(result: CombatExchangeResult): string {
  return [
    `交锋裁决：${result.outcome}`,
    `意图：${result.intent}`,
    `参数/尺度：${result.rankCheck}`,
    "",
    "状态落点：",
    ...result.stateLandings.map(formatStateLanding),
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
