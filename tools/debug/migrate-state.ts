import { cloneState, migrateState, replaceStateForDebug } from "../../engine/core/state-store";
import { isRecord } from "../../engine/core/typebox-validation";
import { textResult, type ToolResult } from "../runtime/tool-result";

interface MigrateStateParams {
  state?: unknown;
  apply?: boolean;
  reason: string;
}

export function migrateStateTool(params: unknown): ToolResult {
  const input = normalizeParams(params);
  const migrated = migrateState(input.state ?? cloneState());
  if (input.apply === true) {
    replaceStateForDebug(migrated);
  }
  return textResult(`State 已迁移到 schemaVersion ${migrated.meta.schemaVersion}。`, {
    result: {
      schemaVersion: migrated.meta.schemaVersion,
      applied: input.apply === true,
      reason: input.reason,
    },
    migratedState: migrated,
  });
}

function normalizeParams(params: unknown): MigrateStateParams {
  if (!isRecord(params)) {
    throw new Error("migrate_state 参数必须是对象。");
  }
  return {
    state: params["state"],
    apply: normalizeOptionalBoolean(params["apply"]),
    reason: assertString(params["reason"], "reason"),
  };
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error("apply 必须是 boolean。");
  }
  return value;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
}
