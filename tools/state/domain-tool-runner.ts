import { writeStateToDetails } from "../../engine/core/state";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { textResult, type ToolResult } from "../runtime/tool-result";

export interface DomainToolRunInput<Result> {
  sessionManager: unknown;
  execute: () => Result;
  details: (result: Result) => Record<string, unknown>;
  message: (result: Result) => string;
}

export function runDomainEventTool<Result>(input: DomainToolRunInput<Result>): ToolResult {
  const result = input.execute();
  persistCurrentState(input.sessionManager);
  const details = input.details(result);
  writeStateToDetails(details);
  return textResult(input.message(result), details);
}

export function resultDetails<Result>(result: Result): Record<string, unknown> {
  return { result };
}
