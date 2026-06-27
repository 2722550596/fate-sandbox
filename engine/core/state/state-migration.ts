import { CURRENT_STATE_SCHEMA_VERSION } from "./state.ts";
import { assertInteger, formatUnknown, isRecord } from "../utils/typebox-validation.ts";

/**
 * Persisted state schema migration —— 项目宪章里唯一允许的兼容层。
 * 迁移链必须线性：每个函数只负责相邻版本 v_n -> v_{n+1}，禁止 O(n²) 迁移矩阵。
 * 这里只处理裸 record 形态；schema 校验由 parseStateSchema 在迁移之后负责。
 *
 * 迁移历史：
 *   v1 → v2: 添加 actor.stats 字段（初始为 null）
 *   v2 → v3: 给所有 actor.sequence 添加 tags: [] 字段
 *   v3 → v4: 给所有 actor 添加 equipment 字段，inventory 添加 storedEquipment
 *   v4 → v5: inventory ordinaryItems → consumables + misc
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
    case 2:
      return migrateV2ToV3(raw);
    case 3:
      return migrateV3ToV4(raw);
    case 4:
      return migrateV4ToV5(raw);
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
  return updated;
}

/**
 * v2 → v3: 给所有 actor.sequence 添加 tags: [] 字段。
 */
function migrateV2ToV3(raw: Record<string, unknown>): Record<string, unknown> {
  const updated = { ...raw };
  const publicState = assertRecordForMigration(updated["public"], "public");
  const actors = assertRecordForMigration(publicState["actors"], "public.actors");

  const updatedActors: Record<string, unknown> = {};
  for (const [actorId, actor] of Object.entries(actors)) {
    if (!isRecord(actor)) {
      updatedActors[actorId] = actor;
      continue;
    }
    const sequence = actor["sequence"];
    if (isRecord(sequence) && sequence["tags"] === undefined) {
      updatedActors[actorId] = { ...actor, sequence: { ...sequence, tags: [] } };
    } else {
      updatedActors[actorId] = actor;
    }
  }

  updated["public"] = { ...publicState, actors: updatedActors };
  return updated;
}

/**
 * v3 → v4: 给所有 actor 添加 equipment 字段，inventory 添加 storedEquipment。
 */
function migrateV3ToV4(raw: Record<string, unknown>): Record<string, unknown> {
  const updated = { ...raw };
  const publicState = assertRecordForMigration(updated["public"], "public");
  const actors = assertRecordForMigration(publicState["actors"], "public.actors");

  const EMPTY_SLOTS = { weapon: null, clothing: null, accessory: null, sealedArtifact: null };

  const updatedActors: Record<string, unknown> = {};
  for (const [actorId, actor] of Object.entries(actors)) {
    if (!isRecord(actor)) {
      updatedActors[actorId] = actor;
      continue;
    }
    const inventory = isRecord(actor["inventory"]) ? actor["inventory"] : {};
    updatedActors[actorId] = {
      ...actor,
      equipment: EMPTY_SLOTS,
      inventory: { ...inventory, storedEquipment: [] },
    };
  }

  updated["public"] = { ...publicState, actors: updatedActors };
  return updated;
}

function readRawSchemaVersion(raw: Record<string, unknown>): number {
  const meta = assertRecordForMigration(raw["meta"], "meta");
  return assertInteger(meta["schemaVersion"], "meta.schemaVersion");
}

/**
 * v4 → v5: inventory 中移除 ordinaryItems，添加 consumables 和 misc。
 */
function migrateV4ToV5(raw: Record<string, unknown>): Record<string, unknown> {
  const updated = { ...raw };
  const publicState = assertRecordForMigration(updated["public"], "public");
  const actors = assertRecordForMigration(publicState["actors"], "public.actors");

  const updatedActors: Record<string, unknown> = {};
  for (const [actorId, actor] of Object.entries(actors)) {
    if (!isRecord(actor)) {
      updatedActors[actorId] = actor;
      continue;
    }
    const inv = isRecord(actor["inventory"]) ? actor["inventory"] : {};
    updatedActors[actorId] = {
      ...actor,
      inventory: {
        storedEquipment: Array.isArray(inv["storedEquipment"]) ? inv["storedEquipment"] : [],
        consumables: [],
        misc: typeof inv["ordinaryItems"] === "object" && inv["ordinaryItems"] !== null
          ? (inv["ordinaryItems"] as unknown[]).map((name, idx) => ({
              id: `migrated-misc-${idx}`,
              name: String(name),
              sequenceRank: "ordinary",
              description: String(name),
              quantity: 1,
            }))
          : [],
      },
    };
  }

  updated["public"] = { ...publicState, actors: updatedActors };
  return updated;
}
function assertRecordForMigration(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`非法 ${fieldName}: ${formatUnknown(value)}。迁移需要对象。`);
  }
  return value;
}