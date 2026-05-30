import assert from "node:assert/strict";
import test from "node:test";

import { updateEconomy } from "./economy";
import { getState, resetState } from "./state";

void test("updateEconomy spends money from a named purse", () => {
  resetState();

  updateEconomy({
    kind: "spend-money",
    purseId: "purse-protagonist-cash",
    amount: 1200,
    reason: "晚餐",
  });

  const purse = getState().public.economy.accessibleFunds.find(
    (entry) => entry.id === "purse-protagonist-cash",
  );
  assert.equal(purse?.amount, 48800);
});

void test("updateEconomy rejects overspending", () => {
  resetState();

  assert.throws(
    () =>
      updateEconomy({
        kind: "spend-money",
        purseId: "purse-protagonist-cash",
        amount: 999999,
        reason: "买下冬木市",
      }),
    /资金不足/,
  );
});
