import { assertConsequenceInput, resolveConsequence, type RawConsequenceInput } from "../../engine/core/consequence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function resolveConsequenceTool(params: RawConsequenceInput): ToolResult {
  const result = resolveConsequence(assertConsequenceInput(params));
  const text = [
    "后果已结算：",
    `⏱️ 时间: ${result.before.当前时间} → ${result.after.当前时间}（+${result.delta.经过分钟} 分钟）`,
    `💤 疲劳: ${formatChange(result.before.疲劳, result.after.疲劳)}`,
    `🔮 魔力负担: ${formatChange(result.before.魔力负担, result.after.魔力负担)}`,
    `⚠️ 危险度: ${formatChange(result.before.危险度, result.after.危险度)}`,
    `🕯️ 神秘暴露: ${formatChange(result.before.神秘暴露, result.after.神秘暴露)}`,
    `👁️ 社会暴露: ${formatChange(result.before.社会暴露, result.after.社会暴露)}`,
    `🗡️ 敌方警觉: ${formatChange(result.before.敌方警觉, result.after.敌方警觉)}`,
    "",
    "叙事约束：",
    ...result.narrativeConstraints.map((constraint) => `- ${constraint}`),
  ].join("\n");

  const details: Record<string, unknown> = {};
  writeStateToDetails(details);
  return textResult(text, details);
}

function formatChange(before: number, after: number): string {
  const delta = after - before;
  const sign = delta >= 0 ? "+" : "";
  return `${before} → ${after} (${sign}${delta})`;
}
