import { CURRENT_STATE_SCHEMA_VERSION } from "./state.ts";
import { assertInteger, formatUnknown, isRecord } from "../utils/typebox-validation.ts";

/**
 * Persisted state schema migration —— 项目宪章里唯一允许的兼容层。
 * 迁移链必须线性：每个函数只负责相邻版本 v_n -> v_{n+1}，禁止 O(n²) 迁移矩阵。
 * 这里只处理裸 record 形态；schema 校验由 parseStateSchema 在迁移之后负责。
 *
 * 迁移历史：
 *   v1 → v2: 添加 actor.stats 字段（初始为 null）
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
  raw: Record<string, unknown>,
  version: number,
): Record<string, unknown> {
  switch (version) {
    case 1:
      return migrateV1ToV2(raw);
    default:
      throw new Error(
        `不支持的 state schemaVersion: ${version}。当前支持版本 ${CURRENT_STATE_SCHEMA_VERSION}。`,
      );
  }
}

/**
 * v1 → v2: 给所有 actor 添加 stats: null 字段。
 */
function migrateV1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  const updated = { ...raw };
  const publicState = assertRecordForMigration(updated["public"], "public");
  const actors = assertRecordForMigration(publicState["actors"], "public.actors");

  const updatedActors: Record<string, unknown> = {};
  for (const [actorId, actor] of Object.entries(actors)) {
    if (isRecord(actor)) {
      updatedActors[actorId] = { ...actor, stats: null };
    } else {
      updatedActors[actorId] = actor;
    }
  }

  updated["public"] = { ...publicState, actors: updatedActors };
  // meta.schemaVersion 由调用方在 migration 后统一更新
  return updated;
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