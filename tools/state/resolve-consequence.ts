import { assertConsequenceInput, resolveConsequence, type RawConsequenceInput } from "../../engine/core/consequence";
import type { ToolResult } from "../runtime/tool-result";

import { runDomainEventTool } from "./domain-tool-runner";

export interface ConsequenceToolDetails {
  actionType: string;
  riskLevel: string;
  pressureSummary: string;
}

export function resolveConsequenceTool(params: RawConsequenceInput, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => resolveConsequence(assertConsequenceInput(params)),
    details: consequenceDetails,
    message: formatResult,
  });
}

function consequenceDetails(result: ReturnType<typeof resolveConsequence>): ConsequenceToolDetails & Record<string, unknown> {
  return {
    actionType: result.actionType,
    riskLevel: result.riskLevel,
    pressureSummary: `${result.durationMinutes}min`,
  };
}

function formatResult(result: ReturnType<typeof resolveConsequence>): string {
  return [
    `# ${result.actionType} · ${result.riskLevel} · ${result.durationMinutes}min`,
    "",
    "## 叙事约束",
    ...result.narrativeConstraints.map((hint) => `- ${hint}`),
  ].join("\n");
}
