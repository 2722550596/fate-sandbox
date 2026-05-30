import { assertConsequenceInput, resolveConsequence, type RawConsequenceInput } from "../../engine/core/consequence";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export interface ConsequenceToolDetails {
  actionType: string;
  riskLevel: string;
  pressureSummary: string;
}

export function resolveConsequenceTool(params: RawConsequenceInput, sessionManager: unknown): ToolResult {
  const validated = assertConsequenceInput(params);
  const result = resolveConsequence(validated);
  persistCurrentState(sessionManager);

  const text = [
    `# ${result.actionType} · ${result.riskLevel} · ${result.durationMinutes}min`,
    "",
    "## 叙事约束",
    ...result.narrativeConstraints.map((hint) => `- ${hint}`),
  ].join("\n");

  const details: Record<string, unknown> = {
    actionType: result.actionType,
    riskLevel: result.riskLevel,
    pressureSummary: `${result.durationMinutes}min`,
  };
  writeStateToDetails(details);
  return textResult(text, details);
}
