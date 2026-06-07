import type { EconomyEvent, MoneyGainSource } from "../../engine/core/economy";
import type { MoneyPurse } from "../../engine/core/state";

import { updateEconomy } from "../../engine/core/economy";
import { assertNonNegativeInteger, getPublicState } from "../../engine/core/state";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";
import { assertOneOfString } from "./domain-assert";

const ECONOMY_EVENT_KINDS = [
  "spend-money",
  "gain-money",
  "add-purse",
  "rename-purse",
  "add-debt",
] as const;

const MONEY_GAIN_SOURCES = [
  "earned",
  "refund",
  "found",
  "gift",
  "withdrawal",
  "sale",
  "quest-reward",
] as const satisfies readonly MoneyGainSource[];

const PURSE_ACCESSES = ["held", "shared", "requires-permission"] as const satisfies readonly MoneyPurse["access"][];

export function updateEconomyTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => updateEconomy(assertEconomyEvent(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function assertEconomyEvent(params: unknown): EconomyEvent {
  const input = assertRecord(params, "update_economy 参数");
  const kind = assertOneOfString(input["kind"], ECONOMY_EVENT_KINDS, "update_economy.kind");
  const reason = assertString(input["reason"], "reason");

  switch (kind) {
    case "spend-money": {
      const purseId = normalizeOptionalString(input["purseId"]);
      assertExistingPurseIdIfPresent(purseId);
      return {
        kind,
        purseId,
        ownerActorId: normalizeOptionalString(input["ownerActorId"]),
        amount: assertNonNegativeInteger(input["amount"], "amount"),
        reason,
      };
    }
    case "gain-money": {
      const purseId = normalizeOptionalString(input["purseId"]);
      assertExistingPurseIdIfPresent(purseId);
      return {
        kind,
        purseId,
        ownerActorId: normalizeOptionalString(input["ownerActorId"]),
        amount: assertNonNegativeInteger(input["amount"], "amount"),
        source: assertOneOfString(input["source"], MONEY_GAIN_SOURCES, "source"),
        counterparty: assertString(input["counterparty"], "counterparty"),
        reason,
      };
    }
    case "add-purse":
      return {
        kind,
        ownerActorId: assertString(input["ownerActorId"], "ownerActorId"),
        label: assertString(input["label"], "label"),
        amount: assertNonNegativeInteger(input["amount"], "amount"),
        access: assertOneOfString(input["access"], PURSE_ACCESSES, "access"),
        reason,
      };
    case "rename-purse": {
      const purseId = assertString(input["purseId"], "purseId");
      assertExistingPurseIdIfPresent(purseId);
      return { kind, purseId, label: assertString(input["label"], "label"), reason };
    }
    case "add-debt":
      return {
        kind,
        debtorActorId: assertString(input["debtorActorId"], "debtorActorId"),
        creditor: assertString(input["creditor"], "creditor"),
        amount: assertNonNegativeInteger(input["amount"], "amount"),
        reason,
      };
  }
}

function assertExistingPurseIdIfPresent(purseId: string | undefined): void {
  if (purseId === undefined) {
    return;
  }
  const exists = getPublicState().economy.accessibleFunds.some((purse) => purse.id === purseId);
  if (!exists) {
    throw new Error(
      `资金账户不存在: ${purseId}。请先调用 get_status 查看可用 purseId；当前可用: ${formatPurseIds()}。`,
    );
  }
}

function formatPurseIds(): string {
  const purseIds = getPublicState().economy.accessibleFunds.map((purse) => purse.id);
  return purseIds.length === 0 ? "无" : purseIds.join(", ");
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
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
