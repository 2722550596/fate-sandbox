import type { CurrencyType } from "../../core/economy/economy-schema.ts";
import type { EconomyEvent } from "../../core/economy/economy.ts";
import type { State } from "../../core/state/state.ts";
import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { parseAmountString } from "../../core/economy/economy-denomination.ts";
import { parseEconomyEvent } from "../../core/economy/economy-schema.ts";
import { updateEconomy } from "../../core/economy/economy.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { resultDetails, runDomainEventTool } from "../system/domain-tool-runner.ts";

export function updateEconomyTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      const raw = isRecord(params) ? params : {};

      // Normalize amount: if string, parse as denomination notation
      let normalized = { ...raw };
      const rawAmount = raw["amount"];
      if (typeof rawAmount === "string") {
        const purse = resolvePurseFromEvent(draft, normalized);
        if (purse === undefined) {
          throw new Error(
            "无法解析金额字符串：未指定 purseId 且无法自动选择 purse。请提供 purseId。",
          );
        }
        normalized = { ...normalized, amount: parseAmountString(rawAmount, purse.currencyType) };
      }

      const event = parseEconomyEvent(normalized, "update_economy 参数");
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

function resolvePurseFromEvent(
  draft: State,
  raw: Record<string, unknown>,
): { currencyType: CurrencyType } | undefined {
  const purseId = typeof raw["purseId"] === "string" ? raw["purseId"] : undefined;
  if (purseId !== undefined) {
    return draft.public.economy.accessibleFunds.find((p) => p.id === purseId);
  }
  const callerActorId = typeof raw["callerActorId"] === "string" ? raw["callerActorId"] : undefined;
  if (callerActorId !== undefined) {
    const held = draft.public.economy.accessibleFunds.filter(
      (p) => p.ownerActorId === callerActorId && p.access === "held",
    );
    return held.length === 1 ? held[0] : undefined;
  }
  return undefined;
}

export const updateEconomyToolDefinition: DomainToolDefinition = {
  name: "update_economy",
  description:
    "更新经济状态。每笔资金指定 purse/account 与 reason，资金增加说明可审计来源。\n\n" +
    "【event kind 场景指南】\n" +
    "- spend-money：日常消费、购买、付费\n" +
    "- gain-money：获得收入、报酬、销售（必须说明 counterparty 与可审计 source）\n" +
    "- add-purse：新增资金池——组织金库、客户预付款、委托人的保证金。必填：ownerActorId, label, amount, access（held/shared/requires-permission）\n" +
    "- update-purse：修改已有钱包的 label 或 access 权限（不可改金额）\n" +
    "amount 可以是数字（最小单位整数，如 300 便士）或字符串（如「1金镑5苏勒」），系统自动换算。\n\n" +
    "禁区：把同行者资金说成玩家随身现金、资金不足时免费兜底，或用 gain-money 设目标数值/凭空发财。",
  parameters: Type.Object({
    kind: Type.String({
      description:
        "允许: spend-money / gain-money / add-purse / update-purse / add-debt / resolve-debt",
    }),
    purseId: Type.Optional(
      Type.String({
        description:
          "资金账户 id；可省略并提供 callerActorId，让工具自动选择该 actor 唯一 held purse",
      }),
    ),
    callerActorId: Type.Optional(
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
