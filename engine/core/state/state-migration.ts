import { CURRENT_STATE_SCHEMA_VERSION } from "./state.ts";
import { assertInteger, formatUnknown, isRecord } from "../utils/typebox-validation.ts";

/**
 * Persisted state schema migration —— 项目宪章里唯一允许的兼容层。
 * 迁移链必须线性：每个函数只负责相邻版本 v_n -> v_{n+1}，禁止 O(n²) 迁移矩阵。
 * 这里只处理裸 record 形态；schema 校验由 parseStateSchema 在迁移之后负责。
 *
 * LOTM 项目从 v1 起步，迁移链当前为空。
 */
export function migrateRawGameState(raw: Record<string, unknown>): Record<string, unknown> {
  let current = structuredClone(raw);
  while (true) {
    const version = readRawSchemaVersion(current);
    if (version === CURRENT_STATE_SCHEMA_VERSION) {
      return current;
    }
    current = migrateOneSchemaVersion(current, version);
  }
}

function migrateOneSchemaVersion(
  _raw: Record<string, unknown>,
  version: number,
): Record<string, unknown> {
  throw new Error(
    `不支持的 state schemaVersion: ${version}。当前支持版本 ${CURRENT_STATE_SCHEMA_VERSION}（LOTM v1 起步，无迁移链）。`,
  );
}

function readRawSchemaVersion(raw: Record<string, unknown>): number {
  const meta = assertRecordForMigration(raw["meta"], "meta");
  return assertInteger(meta["schemaVersion"], "meta.schemaVersion");
}

function assertRecordForMigration(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`非法 ${fieldName}: ${formatUnknown(value)}。迁移需要对象。`);
  }
  return value;
}
