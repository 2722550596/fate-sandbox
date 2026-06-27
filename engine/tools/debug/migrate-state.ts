import type { FateToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { persistStateAfterCommit } from "../../core/state/state-persistence.ts";
import { cloneState, migrateState, replaceStateForDebug } from "../../core/state/state-store.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

interface MigrateStateParams {
  state?: unknown;
  apply?: boolean;
  reason: string;
}

export function migrateStateTool(params: unknown, sessionManager: unknown): ToolResult {
  const input = normalizeParams(params);
  const migrated = migrateState(input.state ?? cloneState());
  const details: Record<string, unknown> = {
    result: {
      schemaVersion: migrated.meta.schemaVersion,
      applied: input.apply === true,
      reason: input.reason,
    },
    migratedState: migrated,
  };
  if (input.apply === true) {
    replaceStateForDebug(migrated);
    // 与 reset_state / override_locked_fact 同款持久化：缺了这步，
    // 下次 session hydrate 会把“已应用”的迁移静默冲回旧状态。
    persistStateAfterCommit(sessionManager, details);
  }
  return textResult(`State 已迁移到 schemaVersion ${migrated.meta.schemaVersion}。`, details);
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

export const migrateStateToolDefinition: FateToolDefinition = {
  name: "migrate_state",
  description:
    "【调试工具】把旧 Game State 程序化迁移到当前 schemaVersion；默认只返回迁移结果，apply=true 时覆盖当前内存状态。必须写明 reason。",
  parameters: Type.Object({
    state: Type.Optional(Type.Unknown()),
    apply: Type.Optional(Type.Boolean()),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    migrateStateTool(params, ctx.sessionManager),
};
