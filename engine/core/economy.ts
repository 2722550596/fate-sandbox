import {
  assertNonEmptyString,
  assertNonNegativeInteger,
  createId,
  updateState,
  type ActorId,
  type MoneyPurse,
} from "./state";

export type EconomyEvent =
  | { kind: "spend-money"; purseId: string; amount: number; reason: string }
  | { kind: "gain-money"; purseId: string; amount: number; reason: string }
  | {
      kind: "add-purse";
      ownerActorId: ActorId;
      label: string;
      amount: number;
      access: MoneyPurse["access"];
      reason: string;
    }
  | { kind: "add-debt"; debtorActorId: ActorId; creditor: string; amount: number; reason: string };

export interface EconomyEventResult {
  message: string;
}

export function updateEconomy(event: EconomyEvent): EconomyEventResult {
  assertNonEmptyString(event.reason, "reason");
  switch (event.kind) {
    case "spend-money":
      return changePurseAmount(
        event.purseId,
        -assertNonNegativeInteger(event.amount, "amount"),
        "资金已支出。",
        event.reason,
      );
    case "gain-money":
      return changePurseAmount(
        event.purseId,
        assertNonNegativeInteger(event.amount, "amount"),
        "资金已增加。",
        event.reason,
      );
    case "add-purse":
      return addPurse(event);
    case "add-debt":
      return addDebt(event);
    default:
      throw new Error("unreachable economy event kind");
  }
}

function changePurseAmount(
  purseId: string,
  delta: number,
  message: string,
  reason: string,
): EconomyEventResult {
  assertNonEmptyString(reason, "reason");
  updateState((draft) => {
    const purse = draft.public.economy.accessibleFunds.find((entry) => entry.id === purseId);
    if (purse === undefined) {
      throw new Error(`资金账户不存在: ${purseId}`);
    }
    const nextAmount = purse.amount + delta;
    if (nextAmount < 0) {
      throw new Error(`资金不足: ${purse.label} 只有 ${purse.amount} 円。`);
    }
    purse.amount = nextAmount;
  });
  return { message };
}

function addPurse(event: Extract<EconomyEvent, { kind: "add-purse" }>): EconomyEventResult {
  updateState((draft) => {
    if (draft.public.actors[event.ownerActorId] === undefined) {
      throw new Error(`owner actor 不存在: ${event.ownerActorId}`);
    }
    draft.public.economy.accessibleFunds.push({
      id: createId("purse"),
      ownerActorId: event.ownerActorId,
      label: assertNonEmptyString(event.label, "label"),
      amount: assertNonNegativeInteger(event.amount, "amount"),
      access: event.access,
    });
  });
  return { message: "资金账户已加入。" };
}

function addDebt(event: Extract<EconomyEvent, { kind: "add-debt" }>): EconomyEventResult {
  updateState((draft) => {
    if (draft.public.actors[event.debtorActorId] === undefined) {
      throw new Error(`debtor actor 不存在: ${event.debtorActorId}`);
    }
    draft.public.economy.debts.push({
      id: createId("debt"),
      debtorActorId: event.debtorActorId,
      creditor: assertNonEmptyString(event.creditor, "creditor"),
      amount: assertNonNegativeInteger(event.amount, "amount"),
      reason: assertNonEmptyString(event.reason, "reason"),
    });
  });
  return { message: "债务已记录。" };
}
