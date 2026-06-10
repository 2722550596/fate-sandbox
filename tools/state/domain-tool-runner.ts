import { cloneState, commitState } from "../../engine/core/state-store";
import { writeStateToDetails } from "../../engine/core/state-persistence";
import type { State } from "../../engine/core/state";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { textResult, type ToolResult } from "../runtime/tool-result";

export interface DomainToolRunInput<Result> {
  sessionManager: unknown;
  /**
   * 领域事件执行体：接收当前 Game State 的 draft 并原地变异。
   * draft 之外不得有任何状态副作用；提交与持久化由 Runner 负责。
   */
  execute: (draft: State) => Result;
  details: (result: Result) => Record<string, unknown>;
  message: (result: Result) => string;
}

export function runDomainEventTool<Result>(input: DomainToolRunInput<Result>): ToolResult {
  const draft = cloneState();
  const result = input.execute(draft);
  commitState(draft);
  persistCurrentState(input.sessionManager);
  const details = input.details(result);
  writeStateToDetails(details);
  return textResult(input.message(result), details);
}

export function resultDetails<Result>(result: Result): Record<string, unknown> {
  return { result };
}
