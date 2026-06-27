import type { EconomyEvent } from "../../core/economy/economy.ts";
import type { State } from "../../core/state/state.ts";
import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { parseEconomyEvent } from "../../core/economy/economy-schema.ts";
import { updateEconomy } from "../../core/economy/economy.ts";
import { resultDetails, runDomainEventTool } from "../system/domain-tool-runner.ts";

export function updateEconomyTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      const event = parseEconomyEvent(params, "update_economy 参数");
      assertExistingPurseIdIfPresent(draft, event);
      return updateEconomy(draft, event);
    },
    details: resultDetails,
    message: (result) => result.message,
  });
}

/** purseId 是否存在依赖当前 Game State，schema 管不了；保留领域校验与 get_status 指引。 */
function assertExistingPurseIdIfPresent(draft: State, event: EconomyEvent): void {
  if (!("purseId" in event) || event.purseId === undefined) {
    return;
  }
  const purseId = event.purseId;
  const exists = draft.public.economy.accessibleFunds.some((purse) => purse.id === purseId);
  if (!exists) {
    throw new Error(
      `资金账户不存在: ${purseId}。请先调用 get_status 查看可用 purseId；当前可用: ${formatPurseIds(draft)}。`,
    );
  }
}

function formatPurseIds(draft: State): string {
  const purseIds = draft.public.economy.accessibleFunds.map((purse) => purse.id);
  return purseIds.length === 0 ? "无" : purseIds.join(", ");
}

export const updateEconomyToolDefinition: FateToolDefinition = {
  name: "update_economy",
  description:
    "更新经济状态。每笔资金指定 purse/account 与 reason，资金增加说明可审计来源。\n\n" +
    "【event kind 场景指南】\n" +
    "- spend-money：日常消费、购买、付费\n" +
    "- gain-money：获得收入、报酬、销售（必须说明 counterparty 与可审计 source）\n" +
    "- add-purse：新增资金池——组织金库、客户预付款、委托人的保证金（新建时设定初始金额）\n" +
    "- update-purse：修改已有钱包的 label 或 access 权限（不可改金额）\n" +
    "- add-debt / resolve-debt：记录和清偿债务\n\n" +
    "禁区：把同行者资金说成玩家随身现金、资金不足时免费兜底，或用 gain-money 设目标数值/凭空发财。",
  parameters: Type.Object({
    kind: Type.String({
      description:
        "允许: spend-money / gain-money / add-purse / update-purse / add-debt / resolve-debt",
    }),
    purseId: Type.Optional(
      Type.String({
        description:
          "资金账户 id；可省略并提供 ownerActorId，让工具自动选择该 actor 唯一 held purse",
      }),
    ),
    ownerActorId: Type.Optional(
      Type.String({
        description: "不确定 purseId 时填写 actorId；若该 actor 只有一个 held purse 会自动选择",
      }),
    ),
    debtorActorId: Type.Optional(
      Type.String({ description: "债务人 actor id；必须已存在于 public actors" }),
    ),
    creditor: Type.Optional(Type.String()),
    debtId: Type.Optional(Type.String({ description: "resolve-debt 必填：要结算的债务 id" })),
    source: Type.Optional(
      Type.String({
        description:
          "资金来源，允许: earned / refund / found / gift / withdrawal / sale / quest-reward",
      }),
    ),
    counterparty: Type.Optional(Type.String({ description: "gain-money 必填：付款方/来源说明" })),
    label: Type.Optional(
      Type.String({ description: "add-purse / update-purse 必填：资金账户玩家可见名称" }),
    ),
    access: Type.Optional(
      Type.String({
        description:
          "add-purse / update-purse 必填：资金访问权限 held / shared / requires-permission",
      }),
    ),
    amount: Type.Optional(
      Type.Unknown({ description: "金额；可填 number 或数字字符串，由领域工具校验。" }),
    ),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    updateEconomyTool(params, ctx.sessionManager),
};
