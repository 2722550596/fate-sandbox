import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { applyTrackedItemEvent } from "../../core/actor/tracked-item.ts";
import { resultDetails, runDomainEventTool } from "../system/domain-tool-runner.ts";
import { normalizeTrackedItemEvent } from "./tracked-item-normalizer.ts";

export function updateTrackedItemTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => applyTrackedItemEvent(draft, normalizeTrackedItemEvent(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

export const updateTrackedItemToolDefinition: FateToolDefinition = {
  name: "update_tracked_item",
  description:
    "追踪关键物品的持有者、状态或新增物品到 trackedItems。\n\n" +
    "【使用边界】\n" +
    "- 关键物跨 actor 转移用 transfer-tracked-item\n" +
    "- 关键物状态变化（损坏/修复/消耗）用 update-tracked-item\n" +
    "- 新增需要长期追踪的物品用 add-tracked-item\n\n" +
    "禁区：\n" +
    "- 普通消耗品和临时杂物不用 tracked item\n" +
    "- 不要用这个工具修改 actor 本身",
  parameters: Type.Object({
    kind: Type.String({
      description: "transfer-tracked-item / update-tracked-item / add-tracked-item",
    }),
    itemId: Type.Optional(Type.String({ description: "transfer / update 时必填：目标 item id" })),
    holderActorId: Type.Optional(Type.Unknown({ description: "物品持有者 actor id，或 null" })),
    ownerActorId: Type.Optional(Type.Unknown({ description: "物品所有者 actor id，或 null" })),
    label: Type.Optional(Type.String({ description: "add-tracked-item 必填：玩家可见标签" })),
    itemKind: Type.Optional(
      Type.String({
        description:
          "mundane / weapon / sealed-artifact / mystical-item / document / key-item / consumable / other",
      }),
    ),
    condition: Type.Optional(
      Type.String({ description: "intact / damaged / broken / spent / unknown" }),
    ),
    visibility: Type.Optional(Type.String({ description: "player-known / suspected" })),
    notes: Type.Optional(Type.Array(Type.String())),
    reason: Type.Optional(Type.String()),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    updateTrackedItemTool(params, ctx.sessionManager),
};
