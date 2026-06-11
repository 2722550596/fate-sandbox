import type { FsnToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { cloneState, migrateState, replaceStateForDebug } from "../../engine/core/state-store.ts";
import { isRecord } from "../../engine/core/typebox-validation.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

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

export const migrateStateToolDefinition: FsnToolDefinition = {
  name: "migrate_state",
  description:
    "【调试工具】把旧 Game State 程序化迁移到当前 schemaVersion；默认只返回迁移结果，apply=true 时覆盖当前内存状态。必须写明 reason。",
  parameters: Type.Object({
    state: Type.Optional(Type.Unknown()),
    apply: Type.Optional(Type.Boolean()),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params) => migrateStateTool(params),
};
