import type { SceneBeatInput, SceneBeatTransitionInput } from "../../engine/core/scene";

import { beginSceneBeat, transitionSceneBeat } from "../../engine/core/scene";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function sceneBeatTool(params: unknown, sessionManager: unknown): ToolResult {
  const event = assertSceneBeatToolInput(params);
  const result =
    event.kind === "begin-beat"
      ? beginSceneBeat(event.input)
      : transitionSceneBeat(event.input);
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
}

type SceneBeatToolInput =
  | { kind: "begin-beat"; input: SceneBeatInput }
  | { kind: "transition-beat"; input: SceneBeatTransitionInput };

function assertSceneBeatToolInput(params: unknown): SceneBeatToolInput {
  if (!isRecord(params)) {
    throw new Error("scene_beat 参数必须是对象。");
  }
  const kind = params["kind"];
  switch (kind) {
    case "begin-beat":
      return { kind, input: params as unknown as SceneBeatInput };
    case "transition-beat":
      return { kind, input: params as unknown as SceneBeatTransitionInput };
    default:
      throw new Error(`非法 scene_beat.kind: ${String(kind)}。`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
