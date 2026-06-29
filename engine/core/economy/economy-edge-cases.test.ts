import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import { updateEconomy } from "./economy.ts";

// ─── add-purse ─────────────────────────────────────────────────

void test("add-purse creates a held purse for existing actor", () => {
  const draft = createInitialState();
  const beforeCount = draft.public.economy.accessibleFunds.length;

  const result = updateEconomy(draft, {
    kind: "add-purse",
    ownerActorId: "protagonist",
    label: "备用资金",
    amount: 100,
    access: "held",
    reason: "创建备用资金账户",
  });

  assert.equal(result.message, "资金账户已加入。");
  assert.equal(draft.public.economy.accessibleFunds.length, beforeCount + 1);
  const purse = draft.public.economy.accessibleFunds.find((p) => p.label === "备用资金")!;
  assert.equal(purse.amount, 100);
  assert.equal(purse.access, "held");
  assert.equal(purse.ownerActorId, "protagonist");
});

void test("add-purse creates a shared purse", () => {
  const draft = createInitialState();

  updateEconomy(draft, {
    kind: "add-purse",
    ownerActorId: "protagonist",
    label: "团队基金",
    amount: 500,
    access: "shared",
    reason: "建立团队共享账户",
  });

  const purse = draft.public.economy.accessibleFunds.find((p) => p.label === "团队基金")!;
  assert.equal(purse.access, "shared");
});

void test("add-purse rejects missing owner actor", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "add-purse",
        ownerActorId: "nonexistent",
        label: "幽灵账户",
        amount: 50,
        access: "held",
        reason: "测试",
      }),
    /owner actor 不存在/,
  );
});

void test("add-purse rejects empty label", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "add-purse",
        ownerActorId: "protagonist",
        label: "",
        amount: 50,
        access: "held",
        reason: "测试",
      }),
    /label/,
  );
});

void test("add-purse rejects zero amount", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "add-purse",
        ownerActorId: "protagonist",
        label: "空账户",
        amount: 0,
        access: "held",
        reason: "测试",
      }),
    /必须大于 0/,
  );
});

// ─── add-debt ──────────────────────────────────────────────────

void test("add-debt rejects missing debtor actor", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "add-debt",
        debtorActorId: "nonexistent",
        creditor: "银行",
        amount: 200,
        reason: "贷款",
      }),
    /debtor actor 不存在/,
  );
});

// ─── resolvePurse edge cases ───────────────────────────────────

void test("spend-money requires purseId or callerActorId", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "spend-money",
        amount: 5,
        reason: "无资金标识的支出",
      }),
    /必须提供 purseId/,
  );
});

void test("spend-money by callerActorId throws when multiple held purses exist", () => {
  const draft = createInitialState();
  // add a second held purse so protagonist has >1
  draft.public.economy.accessibleFunds.push({
    id: "purse-protagonist-cash-2",
    ownerActorId: "protagonist",
    label: "备用现金",
    amount: 50,
    currencyType: "loen",
    access: "held",
  });
  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "spend-money",
        callerActorId: "protagonist",
        amount: 5,
        reason: "测试多账户",
      }),
    /actor .+ 有多个 held 资金账户/,
  );
});

void test("spend-money by callerActorId throws when no held purse exists", () => {
  const draft = createInitialState();
  // protagonist only has "held" purses; move them all to "requires-permission"
  for (const purse of draft.public.economy.accessibleFunds) {
    if (purse.ownerActorId === "protagonist") {
      purse.access = "requires-permission";
    }
  }

  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "spend-money",
        callerActorId: "protagonist",
        amount: 5,
        reason: "测试无 held 账户",
      }),
    /actor .+ 没有可自动选择的 held 资金账户/,
  );
});

// ─── gain-money edge cases ────────────────────────────────────

void test("gain-money with small found amount is allowed", () => {
  const draft = createInitialState();

  updateEconomy(draft, {
    kind: "gain-money",
    purseId: "purse-protagonist-cash",
    amount: 10,
    source: "found",
    counterparty: "地上",
    reason: "捡到10便士",
  });

  const purse = draft.public.economy.accessibleFunds.find(
    (p) => p.id === "purse-protagonist-cash",
  )!;
  assert.equal(purse.amount, 34);
});

void test("gain-money rejects cheating terms in reason", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "gain-money",
        purseId: "purse-protagonist-cash",
        amount: 100,
        source: "earned",
        counterparty: "值夜者",
        reason: "凭空增加资金",
      }),
    /不能用 gain-money/,
  );
});

void test("gain-money rejects 改成 term in reason", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "gain-money",
        purseId: "purse-protagonist-cash",
        amount: 100,
        source: "earned",
        counterparty: "值夜者",
        reason: "改成 1000 便士",
      }),
    /不能用 gain-money/,
  );
});

// ─── update-purse partial updates ──────────────────────────────

void test("update-purse changes label only", () => {
  const draft = createInitialState();

  updateEconomy(draft, {
    kind: "update-purse",
    purseId: "purse-protagonist-cash",
    label: "主角钱包",
    reason: "重命名",
  });

  const purse = draft.public.economy.accessibleFunds.find(
    (p) => p.id === "purse-protagonist-cash",
  )!;
  assert.equal(purse.label, "主角钱包");
  assert.equal(purse.access, "held"); // unchanged
  assert.equal(purse.amount, 24); // unchanged
});

void test("update-purse changes access only", () => {
  const draft = createInitialState();

  updateEconomy(draft, {
    kind: "update-purse",
    purseId: "purse-protagonist-cash",
    access: "requires-permission",
    reason: "需要审批",
  });

  const purse = draft.public.economy.accessibleFunds.find(
    (p) => p.id === "purse-protagonist-cash",
  )!;
  assert.equal(purse.access, "requires-permission");
  assert.equal(purse.label, "随身便士"); // unchanged
  assert.equal(purse.amount, 24); // unchanged
});

void test("update-purse rejects unknown purseId", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      updateEconomy(draft, {
        kind: "update-purse",
        purseId: "does-not-exist",
        label: "新名字",
        reason: "测试",
      }),
    /资金账户不存在/,
  );
});
