import type { ServantFormEvent } from "../../engine/core/servant";
import type { FateParams, ParamModifier, PermanentDefect, ServantContractState } from "../../engine/core/state";

import { updateServantForm } from "../../engine/core/servant";
import { assertIsoDateString, assertNonNegativeInteger } from "../../engine/core/state";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";
import { assertOneOfString } from "./domain-assert";

const ALLOWED_KINDS = [
  "spend-mana",
  "restore-mana",
  "damage-spiritual-core",
  "add-param-modifier",
  "change-contract",
  "add-permanent-defect",
] as const satisfies readonly ServantFormEvent["kind"][];
const LOCKED_FIELD_KINDS = ["change-true-name", "change-class", "change-base-params", "change-noble-phantasm"] as const;

const CONTRACT_STATUSES = ["stable", "weak", "cut", "masterless"] as const satisfies readonly ServantContractState["status"][];
const MANA_SUPPLIES = ["sufficient", "strained", "starved"] as const satisfies readonly ServantContractState["manaSupply"][];
const FATE_PARAM_KEYS = [
  "strength",
  "endurance",
  "agility",
  "mana",
  "luck",
  "noblePhantasm",
] as const satisfies readonly (keyof FateParams)[];

export function updateServantFormTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => updateServantForm(assertServantFormEvent(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function assertServantFormEvent(params: unknown): ServantFormEvent {
  const input = assertRecord(params, "update_servant_form 参数");
  const kind = assertServantFormKind(input["kind"]);
  const actorId = assertString(input["actorId"], "actorId");
  const reason = assertString(input["reason"], "reason");

  if (isResourceUpdateKind(kind)) {
    return { kind, actorId, amount: assertNonNegativeInteger(input["amount"], "amount"), reason };
  }
  if (kind === "add-param-modifier") {
    return { kind, actorId, modifier: assertParamModifier(input["modifier"]), reason };
  }
  if (kind === "change-contract") {
    return { kind, actorId, contract: assertServantContract(input["contract"]), reason };
  }
  return { kind, actorId, defect: assertPermanentDefect(input["defect"]), reason };
}

function assertServantFormKind(value: unknown): ServantFormEvent["kind"] {
  if (isLockedFieldKind(value)) {
    throw lockedFieldKindError(value);
  }
  try {
    return assertOneOfString(value, ALLOWED_KINDS, "update_servant_form.kind");
  } catch (error) {
    throw new Error(`${String(error)} 常规工具只能更新资源、契约、参数修正和永久缺损。`, {
      cause: error,
    });
  }
}

function isResourceUpdateKind(
  kind: ServantFormEvent["kind"],
): kind is "spend-mana" | "restore-mana" | "damage-spiritual-core" {
  return kind === "spend-mana" || kind === "restore-mana" || kind === "damage-spiritual-core";
}

function isLockedFieldKind(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  return LOCKED_FIELD_KINDS.some((kind) => kind === value);
}

function lockedFieldKindError(value: unknown): Error {
  return new Error(
    `非法 update_servant_form.kind: ${formatUnknown(value)}。真名、职阶、基础参数、宝具是锁定字段，必须使用 debug 工具 override_locked_fact（宝具当前无常规增删事件），严禁使用 patch_state。允许值: ${ALLOWED_KINDS.join(", ")}。`,
  );
}

function assertServantContract(value: unknown): ServantContractState {
  const contract = assertRecord(value, "contract");
  return {
    masterActorId: normalizeNullableString(contract["masterActorId"], "contract.masterActorId"),
    masterName: normalizeNullableString(contract["masterName"], "contract.masterName"),
    status: assertOneOfString(contract["status"], CONTRACT_STATUSES, "contract.status"),
    manaSupply: assertOneOfString(contract["manaSupply"], MANA_SUPPLIES, "contract.manaSupply"),
  };
}

function assertParamModifier(value: unknown): ParamModifier {
  const modifier = assertRecord(value, "modifier");
  return {
    id: normalizeOptionalString(modifier["id"]) ?? "",
    source: assertString(modifier["source"], "modifier.source"),
    affectedParams: assertArray(modifier["affectedParams"], "modifier.affectedParams").map((entry) =>
      assertOneOfString(entry, FATE_PARAM_KEYS, "modifier.affectedParams[]"),
    ),
    summary: assertString(modifier["summary"], "modifier.summary"),
    expiresAt: normalizeExpiresAt(modifier["expiresAt"]),
  };
}

function assertPermanentDefect(value: unknown): PermanentDefect {
  const defect = assertRecord(value, "defect");
  return {
    id: normalizeOptionalString(defect["id"]) ?? "",
    source: assertString(defect["source"], "defect.source"),
    text: assertString(defect["text"], "defect.text"),
    mechanicalEffect: assertString(defect["mechanicalEffect"], "defect.mechanicalEffect"),
  };
}

function normalizeExpiresAt(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return assertIsoDateString(value, "modifier.expiresAt");
}

function normalizeNullableString(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return assertString(value, fieldName);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function assertArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是数组。`);
  }
  return value;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
}

function formatUnknown(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
