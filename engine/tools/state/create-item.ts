import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ConsumableItemData, MiscItemData, SequenceRank } from "../../core/state/state.ts";
import { Type } from "typebox";

import { generateConsumableStats } from "../../core/equipment/consumable-stats.ts";
import { getPathwayAndRank } from "../../core/sequence-lookup.ts";
import { sequenceBaseline } from "../../config/index.ts";
import { textResult } from "../runtime/tool-result.ts";
import { runDomainEventTool } from "./domain-tool-runner.ts";
import { assertNonEmptyString } from "../../core/utils/typebox-validation.ts";
import { createId } from "../../core/utils/ids.ts";

export function createItemTool(
  params: unknown,
  sessionManager: unknown,
): ReturnType<typeof textResult> {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      const raw = params as Record<string, unknown>;
      const actorId = assertNonEmptyString(raw["actorId"], "actorId");
      const name = assertNonEmptyString(raw["name"], "name");
      const category = (raw["category"] as string) ?? "misc";
      const quantity = (raw["quantity"] as number) ?? 1;
      const description = (raw["description"] as string) ?? "";
      const sequenceName = raw["sequenceName"] as string | undefined;
      const sequenceRank: SequenceRank = sequenceName
        ? (getPathwayAndRank(sequenceName)?.rank ?? "ordinary")
        : "ordinary";

      const actor = draft.public.actors[actorId];
      if (!actor) throw new Error(`actor 不存在: ${actorId}`);

      const id = createId(draft, "item");

      if (category === "consumable") {
        const type = (raw["type"] as string) ?? "其他";
        const effect = (raw["effect"] as "杀伤" | "恢复" | "增益") ?? "其他";
        const targetAttribute = raw["targetAttribute"] as string | undefined;

        const rankIndex = rankToIndex(sequenceRank);
        const baseValue = sequenceBaseline[String(rankIndex)] ?? sequenceBaseline["普通"] ?? 200;

        const stats = generateConsumableStats(baseValue, type, effect, targetAttribute);

        const consumable: ConsumableItemData = {
          id,
          name,
          sequenceRank,
          type,
          effect,
          targetAttribute,
          damageBonus: stats.damageBonus,
          statChanges: stats.statChanges,
          sourceAttribute: stats.sourceAttribute,
          sourceCost: stats.sourceCost,
          description,
          quantity,
        };
        actor.inventory.consumables.push(consumable);
        return { message: `已添加消耗品 ${name}（${quantity}个）`, id };
      }

      // misc
      const misc: MiscItemData = {
        id,
        name,
        sequenceRank,
        description,
        quantity,
      };
      actor.inventory.misc.push(misc);
      return { message: `已添加杂物 ${name}（${quantity}个）`, id };
    },
    details: (result) => ({ result }),
    message: (result) => result.message,
  });
}

function rankToIndex(rank: SequenceRank): number {
  switch (rank) {
    case "pillar": return -2;
    case "old-one": return -1;
    case "seq-0": return 0;
    case "seq-1": return 1;
    case "seq-2": return 2;
    case "seq-3": return 3;
    case "seq-4": return 4;
    case "seq-5": return 5;
    case "seq-6": return 6;
    case "seq-7": return 7;
    case "seq-8": return 8;
    case "seq-9": return 9;
    default: return 10;
  }
}

export const createItemToolDefinition: FateToolDefinition = {
  name: "create_item",
  description:
    "创建消耗品或杂物，存入 actor 背包。\n\n" +
    "消耗品（category=consumable）：自动根据类型和效果生成属性修正。\n" +
    "  需提供 type（符咒/药品/子弹/卷轴/神性/其他）和 effect（杀伤/恢复/增益）。\n" +
    "  可选：targetAttribute（作用属性）、sequenceName（序列名）。\n\n" +
    "杂物（category=misc）：纯文本物品，不生成属性。只需 name 和可选的 quantity。",
  parameters: Type.Object({
    actorId: Type.String({ description: "存入目标 actorId" }),
    name: Type.String({ description: "物品名称" }),
    category: Type.String({ description: "物品类别: consumable / misc" }),
    type: Type.Optional(Type.String({ description: "消耗品子类型: 符咒/药品/子弹/卷轴/神性/其他" })),
    effect: Type.Optional(Type.String({ description: "消耗品效果: 杀伤/恢复/增益" })),
    targetAttribute: Type.Optional(Type.String({ description: "作用属性: vitality/agility/spirituality/sanity/humanity/luck/全属性" })),
    sequenceName: Type.Optional(Type.String({ description: "序列名（可选，决定序列等级和基准值）" })),
    quantity: Type.Optional(Type.Number({ description: "数量（默认 1）" })),
    description: Type.Optional(Type.String({ description: "描述" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    createItemTool(params, ctx.sessionManager),
};