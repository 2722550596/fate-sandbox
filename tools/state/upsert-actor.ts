import type { PublicActorState } from "../../engine/core/state";
import type { ToolResult } from "../runtime/tool-result";

import { upsertActor } from "../../engine/core/actor";
import { parseActorRegistryInput } from "../../engine/core/actor-schema";
import { ACTOR_KINDS } from "../../engine/core/state-enum-schemas";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";
import { isRecord } from "../../engine/core/typebox-validation";

/**
 * upsert_actor 边界：结构校验交给 actor-schema；这里只保留领域归一化——
 * setup-protagonist 的 stripUndefined / magecraft / master role 缺省，
 * servant 的 nullable 缺省与玩家从者真名保护。
 */
export function upsertActorTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      upsertActor(draft, parseActorRegistryInput(prepareUpsertActorParams(params), "upsert_actor 参数")),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function prepareUpsertActorParams(params: unknown): unknown {
  if (!isRecord(params)) {
    return params;
  }
  switch (params["kind"]) {
    case "setup-protagonist":
      return { ...params, actor: normalizeSetupProtagonistActor(params["actor"]) };
    case "upsert-public-npc":
    case "ensure-public-npc":
      return { ...params, npc: normalizeNpcInput(params["npc"]) };
    case "upsert-servant":
      return { ...params, servant: normalizeServantInput(params["servant"]) };
    default:
      return params;
  }
}

function normalizeNpcInput(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  return { ...value, publicRoles: normalizeMasterRoles(value["publicRoles"]) };
}

function normalizeServantInput(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  guardProtagonistTrueName(value);
  return {
    ...value,
    masterActorId: value["masterActorId"] ?? null,
    masterName: value["masterName"] ?? null,
    publicRoles: normalizeMasterRoles(value["publicRoles"]),
  };
}

/** 玩家从者初始化不得公开真名——指向 reveal_secret 的领域报错，先于 schema。 */
function guardProtagonistTrueName(servant: Record<string, unknown>): void {
  if (servant["id"] === "protagonist" && servant["trueNameStatus"] === "revealed") {
    throw new Error(
      "玩家从者初始化不得把 servant.trueNameStatus 写成 revealed；玩家知道真名也应保持 public trueName hidden/suspected，并用 reveal_secret 配置隐藏真名。",
    );
  }
}

/** master role 缺省字段：commandSpells {3,3}、contractedServantIds []。 */
function normalizeMasterRoles(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }
  return value.map((role) => {
    const stripped = stripUndefined(role);
    if (!isRecord(stripped) || stripped["kind"] !== "master") {
      return stripped;
    }
    return {
      ...stripped,
      commandSpells: stripped["commandSpells"] ?? { total: 3, remaining: 3 },
      contractedServantIds: stripped["contractedServantIds"] ?? [],
    };
  });
}

function normalizeSetupProtagonistActor(actor: unknown): PublicActorState {
  const normalized = stripUndefinedRecord(assertRecord(actor, "actor"));
  normalized["roles"] = normalizeMasterRoles(normalized["roles"]);
  normalized["magecraft"] = normalizeSetupMagecraft(normalized["magecraft"]);
  if (normalized["servantForm"] === undefined) {
    normalized["servantForm"] = null;
  }
  assertPublicActorStateCandidate(normalized);
  return normalized;
}

function assertPublicActorStateCandidate(value: unknown): asserts value is PublicActorState {
  const actor = assertRecord(value, "actor");
  assertString(actor["id"], "actor.id");
  assertActorKind(actor["kind"], "actor.kind");
  // Full actor shape is intentionally validated by the Domain Event Tool Runner commit (assertState) after cleanup; this assertion only narrows the tool-boundary record type.
}

function normalizeSetupMagecraft(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  const magecraft = stripUndefined(value);
  if (!isRecord(magecraft)) {
    return magecraft;
  }

  const circuits = normalizeSetupCircuits(magecraft["circuits"]);
  const disciplines = magecraft["disciplines"];
  const affiliation = magecraft["affiliation"];
  const hasDisciplines = Array.isArray(disciplines) && disciplines.length > 0;
  const hasAffiliation = typeof affiliation === "string" && affiliation.trim().length > 0;
  if (circuits === undefined && !hasDisciplines && !hasAffiliation) {
    return null;
  }

  return {
    circuits: circuits ?? defaultUnknownCircuits(),
    disciplines: disciplines ?? [],
    affiliation: hasAffiliation ? affiliation.trim() : null,
  };
}

function normalizeSetupCircuits(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  const circuits = stripUndefined(value);
  if (!isRecord(circuits)) {
    return circuits;
  }
  return {
    count: circuits["count"] ?? "未确认",
    quality: circuits["quality"] ?? "none",
    od: circuits["od"] ?? 100,
    status: circuits["status"] ?? "normal",
    traits: circuits["traits"] ?? [],
  };
}

function defaultUnknownCircuits(): Record<string, unknown> {
  return { count: "未确认", quality: "none", od: 100, status: "normal", traits: [] };
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  if (!isRecord(value)) {
    return value;
  }
  return stripUndefinedRecord(value);
}

function stripUndefinedRecord(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      result[key] = stripUndefined(value);
    }
  }
  return result;
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
}

function assertActorKind(value: unknown, fieldName: string): void {
  if (typeof value !== "string" || !ACTOR_KINDS.some((kind) => kind === value)) {
    throw new Error(`非法 ${fieldName}: ${String(value)}。允许值: ${ACTOR_KINDS.join(", ")}。`);
  }
}
