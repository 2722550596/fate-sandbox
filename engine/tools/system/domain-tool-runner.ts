import { cloneState, commitState } from "../../core/state/state-store.ts";
import { persistStateAfterCommit } from "../../core/state/state-persistence.ts";
import type { State } from "../../core/state/state.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

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
  const details = input.details(result);
  persistStateAfterCommit(input.sessionManager, details);
  return textResult(input.message(result), details);
}

export function resultDetails<Result>(result: Result): Record<string, unknown> {
  return { result };
}
