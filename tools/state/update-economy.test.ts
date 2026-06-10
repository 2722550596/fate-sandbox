import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../engine/core/state-store";
import { updateEconomyTool } from "./update-economy";

void test("updateEconomy reports available purse ids for an unknown purse", () => {
  resetState();

  assert.throws(
    () =>
      updateEconomyTool(
        {
          kind: "spend-money",
          purseId: "shirou-wallet",
          amount: 100,
          reason: "ergonomics regression test",
        },
        undefined,
      ),
    /当前可用: purse-protagonist-cash/,
  );
});

void test("updateEconomyTool renames a purse", () => {
  resetState();

  updateEconomyTool(
    {
      kind: "rename-purse",
      purseId: "purse-protagonist-cash",
      label: "绫香的钱包",
      reason: "修正玩家可见资金账户名称",
    },
    undefined,
  );

  assert.equal(getState().public.economy.accessibleFunds[0]?.label, "绫香的钱包");
});

void test("updateEconomy reports invalid enum-like fields clearly", () => {
  assert.throws(
    () =>
      updateEconomyTool(
        {
          kind: "gain-money",
          purseId: "purse-protagonist-cash",
          amount: 100,
          source: "windfall",
          counterparty: "路人",
          reason: "模型误填资金来源",
        },
        undefined,
      ),
    /source 必须是允许值之一: earned, refund, found, gift, withdrawal, sale, quest-reward/,
  );

  assert.throws(
    () =>
      updateEconomyTool(
        {
          kind: "add-purse",
          ownerActorId: "protagonist",
          label: "备用现金",
          amount: 100,
          access: "public",
          reason: "模型误填访问权限",
        },
        undefined,
      ),
    /access 必须是允许值之一: held, shared, requires-permission/,
  );
});
