import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/state-store.ts";
import { updateEconomy } from "./economy.ts";

void test("updateEconomy spends money from a named purse", () => {
  const draft = createInitialState();

  updateEconomy(draft, {
    kind: "spend-money",
    purseId: "purse-protagonist-cash",
    amount: 5,
    reason: "晚餐",
  });

  const purse = draft.public.economy.accessibleFunds.find(
    (entry) => entry.id === "purse-protagonist-cash",
  );
  assert.equal(purse?.amount, 19);
});

void test("updateEconomy can spend from actor held purse", () => {
  const draft = createInitialState();

  updateEconomy(draft, {
    kind: "spend-money",
    ownerActorId: "protagonist",
    amount: 8,
    reason: "采购杂货",
  });

  const purse = draft.public.economy.accessibleFunds.find(
    (entry) => entry.id === "purse-protagonist-cash",
  );
  assert.equal(purse?.amount, 16);
});

void test("updateEconomy can gain money from an audited source", () => {
  const draft = createInitialState();

  updateEconomy(draft, {
    kind: "gain-money",
    ownerActorId: "protagonist",
    amount: 50,
    source: "earned",
    counterparty: "廷根值夜者小队",
    reason: "完成任务的报酬",
  });

  const purse = draft.public.economy.accessibleFunds.find(
    (entry) => entry.id === "purse-protagonist-cash",
  );
  assert.equal(purse?.amount, 74);
});

void test("updateEconomy rejects unaudited large found money", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "gain-money",
        purseId: "purse-protagonist-cash",
        amount: 999999,
        source: "found",
        counterparty: "路边",
        reason: "把现金改成999999便士",
      }),
    /不能用 gain-money 把现金设为目标数值|大额资金增加不能标记为 found/,
  );
});

void test("updateEconomy requires a counterparty for gained money", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "gain-money",
        purseId: "purse-protagonist-cash",
        amount: 10,
        source: "gift",
        counterparty: "",
        reason: "礼物",
      }),
    /counterparty/,
  );
});

void test("updateEconomy rejects zero amount changes", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "gain-money",
        purseId: "purse-protagonist-cash",
        amount: 0,
        source: "earned",
        counterparty: "值夜者",
        reason: "报酬",
      }),
    /必须大于 0/,
  );
  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "spend-money",
        purseId: "purse-protagonist-cash",
        amount: 0,
        reason: "测试零额支出",
      }),
    /必须大于 0/,
  );
});

void test("updateEconomy rejects overspending", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "spend-money",
        purseId: "purse-protagonist-cash",
        amount: 999999,
        reason: "购买廷根市",
      }),
    /资金不足/,
  );
});

void test("updateEconomy renames a purse without changing funds", () => {
  const draft = createInitialState();

  updateEconomy(draft, {
    kind: "rename-purse",
    purseId: "purse-protagonist-cash",
    label: "主角的钱包",
    reason: "修正资金账户显示名",
  });

  const purse = draft.public.economy.accessibleFunds.find(
    (entry) => entry.id === "purse-protagonist-cash",
  );
  assert.equal(purse?.label, "主角的钱包");
  assert.equal(purse?.amount, 24);
});

void test("updateEconomy reports available purse ids for an unknown purse", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "spend-money",
        purseId: "protagonist-cash",
        amount: 5,
        reason: "测试错误信息",
      }),
    /purse-protagonist-cash/,
  );
});
