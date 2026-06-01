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

void test("updateEconomy can spend from actor held purse", () => {
  resetState();

  updateEconomy({
    kind: "spend-money",
    ownerActorId: "protagonist",
    amount: 4200,
    reason: "采购医疗用品",
  });

  const purse = getState().public.economy.accessibleFunds.find(
    (entry) => entry.id === "purse-protagonist-cash",
  );
  assert.equal(purse?.amount, 45800);
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

void test("updateEconomy reports available purse ids for an unknown purse", () => {
  resetState();

  assert.throws(
    () =>
      updateEconomy({
        kind: "spend-money",
        purseId: "protagonist-cash",
        amount: 100,
        reason: "测试错误信息",
      }),
    /purse-protagonist-cash/,
  );
});
