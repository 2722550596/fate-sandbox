import type { ActorId, MoneyPurse, State } from "../state/state.ts";

import { createId } from "../utils/ids.ts";
import { assertNonEmptyString, assertNonNegativeInteger } from "../utils/typebox-validation.ts";
import { SMALLEST_UNIT_LABELS } from "./economy-denomination.ts";

function assertPositiveInteger(value: unknown, fieldName: string): number {
  const amount = assertNonNegativeInteger(value, fieldName);
  if (amount === 0) {
    throw new Error(`非法${fieldName}: 0。必须大于 0。`);
  }
  return amount;
}

import type { EconomyEvent } from "./economy-schema.ts";

export type { EconomyEvent, MoneyGainSource } from "./economy-schema.ts";

export interface EconomyEventResult {
  message: string;
}

export function updateEconomy(draft: State, event: EconomyEvent): EconomyEventResult {
  assertNonEmptyString(event.reason, "reason");
  switch (event.kind) {
    case "spend-money": {
      const rawAmount = assertPositiveInteger(event.amount, "amount");
      return changePurseAmount(
        draft,
        event.purseId,
        event.callerActorId,
        -rawAmount,
        "资金已支出。",
        event.reason,
      );
    }
    case "gain-money": {
      assertAuditableGain(event);
      const rawAmount = assertPositiveInteger(event.amount, "amount");
      return changePurseAmount(
        draft,
        event.purseId,
        event.callerActorId,
        rawAmount,
        "资金已增加。",
        event.reason,
      );
    }
    case "add-purse": {
      const rawAmount = assertPositiveInteger(event.amount, "amount");
      const currencyType = event.currencyType ?? "loen";
      return addPurse(draft, { ...event, amount: rawAmount, currencyType });
    }
    case "update-purse":
      return updatePurse(draft, event);
    case "add-debt":
      return addDebt(draft, event);
    case "resolve-debt":
      return resolveDebt(draft, event);
    default:
      throw new Error("unreachable economy event kind");
  }
}

function changePurseAmount(
  draft: State,
  purseId: string | undefined,
  callerActorId: ActorId | undefined,
  delta: number,
  message: string,
  reason: string,
): EconomyEventResult {
  assertNonEmptyString(reason, "reason");
  const purse = resolvePurse(draft.public.economy.accessibleFunds, purseId, callerActorId);
  const nextAmount = purse.amount + delta;
  if (nextAmount < 0) {
    throw new Error(
      `资金不足: ${purse.label} 只有 ${purse.amount}${SMALLEST_UNIT_LABELS[purse.currencyType]}。`,
    );
  }
  purse.amount = nextAmount;
  return { message };
}

function assertAuditableGain(event: Extract<EconomyEvent, { kind: "gain-money" }>): void {
  assertNonEmptyString(event.counterparty, "counterparty");
  const amount = assertPositiveInteger(event.amount, "amount");
  if (amount > 50000 && event.source === "found") {
    throw new Error(
      "大额资金增加不能标记为 found；必须提供可审计来源如 sale/withdrawal/gift/earned。不能用 gain-money 把现金设为目标数值。",
    );
  }
  const reason = event.reason.toLowerCase();
  const cheatingTerms = ["凭空", "作弊", "改成", "设为", "免费发财", "无代价", "999999"];
  if (cheatingTerms.some((term) => reason.includes(term))) {
    throw new Error("资金增加必须说明可审计来源；不能用 gain-money 把现金设为目标数值或凭空发财。");
  }
}

function resolvePurse(
  purses: MoneyPurse[],
  purseId: string | undefined,
  callerActorId: ActorId | undefined,
): MoneyPurse {
  if (purseId !== undefined) {
    const purse = purses.find((entry) => entry.id === purseId);
    if (purse !== undefined) {
      return purse;
    }
    throw new Error(`资金账户不存在: ${purseId}。当前可用: ${formatPurseIds(purses)}。`);
  }

  if (callerActorId === undefined) {
    throw new Error(`资金事件必须提供 purseId；若不确定，可提供 callerActorId 自动选择账户。`);
  }

  const ownedPurses = purses.filter(
    (entry) => entry.ownerActorId === callerActorId && entry.access === "held",
  );
  if (ownedPurses.length === 1) {
    const purse = ownedPurses[0];
    if (purse === undefined) {
      throw new Error("unreachable owned purse lookup");
    }
    return purse;
  }
  if (ownedPurses.length === 0) {
    throw new Error(
      `actor ${callerActorId} 没有可自动选择的 held 资金账户。当前可用: ${formatPurseIds(purses)}。`,
    );
  }
  throw new Error(
    `actor ${callerActorId} 有多个 held 资金账户，请指定 purseId。候选: ${formatPurseIds(ownedPurses)}。`,
  );
}

function formatPurseIds(purses: MoneyPurse[]): string {
  const ids = purses.map((purse) => purse.id);
  return ids.length === 0 ? "无" : ids.join(", ");
}

function addPurse(
  draft: State,
  event: Extract<EconomyEvent, { kind: "add-purse" }>,
): EconomyEventResult {
  if (draft.public.actors[event.ownerActorId] === undefined) {
    throw new Error(`owner actor 不存在: ${event.ownerActorId}`);
  }
  draft.public.economy.accessibleFunds.push({
    id: createId(draft, "purse"),
    ownerActorId: event.ownerActorId,
    label: assertNonEmptyString(event.label, "label"),
    amount: assertPositiveInteger(event.amount, "amount"),
    currencyType: event.currencyType ?? "loen",
    access: event.access,
  });
  return { message: "资金账户已加入。" };
}

function updatePurse(
  draft: State,
  event: Extract<EconomyEvent, { kind: "update-purse" }>,
): EconomyEventResult {
  const purse = resolvePurse(draft.public.economy.accessibleFunds, event.purseId, undefined);
  if (event.label !== undefined) {
    purse.label = assertNonEmptyString(event.label, "label");
  }
  if (event.access !== undefined) {
    purse.access = event.access;
  }
  return { message: "资金账户已更新。" };
}

function addDebt(
  draft: State,
  event: Extract<EconomyEvent, { kind: "add-debt" }>,
): EconomyEventResult {
  if (draft.public.actors[event.debtorActorId] === undefined) {
    throw new Error(`debtor actor 不存在: ${event.debtorActorId}`);
  }

  // 借贷上限：当前可支配资金 × 1000
  const totalFunds = draft.public.economy.accessibleFunds
    .filter((p) => p.ownerActorId === event.debtorActorId)
    .reduce((sum, p) => sum + p.amount, 0);
  const maxDebt = Math.max(totalFunds * 1000, 1000); // 至少 1000 so small amounts don't zero out
  if (assertPositiveInteger(event.amount, "amount") > maxDebt) {
    throw new Error(
      `借贷金额 ${event.amount} 超过上限 ${maxDebt}（当前可支配资金 ${totalFunds} × 1000）。`,
    );
  }

  draft.public.economy.debts.push({
    id: createId(draft, "debt"),
    debtorActorId: event.debtorActorId,
    creditor: assertNonEmptyString(event.creditor, "creditor"),
    amount: assertPositiveInteger(event.amount, "amount"),
    reason: assertNonEmptyString(event.reason, "reason"),
  });
  return { message: `债务已记录。当前债务: ${formatActiveDebts(draft)}` };
}

function resolveDebt(
  draft: State,
  event: Extract<EconomyEvent, { kind: "resolve-debt" }>,
): EconomyEventResult {
  const index = draft.public.economy.debts.findIndex((debt) => debt.id === event.debtId);
  if (index === -1) {
    const available = draft.public.economy.debts
      .map((d) => `${d.id}（${d.creditor} 方，${d.amount} 便士）`)
      .join("；");
    throw new Error(`债务不存在: ${event.debtId}。当前可用: ${available || "无"}。`);
  }
  draft.public.economy.debts.splice(index, 1);
  return { message: `债务已结算：${event.debtId}。剩余债务: ${formatActiveDebts(draft)}` };
}
function formatActiveDebts(draft: State): string {
  const debts = draft.public.economy.debts;
  if (debts.length === 0) return "无";
  return debts
    .map((d) => `${d.id}: ${d.debtorActorId} 欠 ${d.creditor} ${d.amount} 便士（${d.reason}）`)
    .join("; ");
}
