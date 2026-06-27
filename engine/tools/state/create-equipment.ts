import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { EquipmentItemData } from "../../core/state/state.ts";
import type { SequenceRank } from "../../core/state/state-enum-schemas.ts";
import { Type } from "typebox";

import { generateItemStats } from "../../core/equipment/generate-item-stats.ts";
import { getPathwayAndRank } from "../../core/sequence-lookup.ts";
import { sequenceBaseline, sequenceTagsMapping } from "../../config/index.ts";
import { textResult } from "../runtime/tool-result.ts";
import { runDomainEventTool } from "./domain-tool-runner.ts";
import { assertNonEmptyString } from "../../core/utils/typebox-validation.ts";
import { createId } from "../../core/utils/ids.ts";

export function createEquipmentTool(
  params: unknown,
  sessionManager: unknown,
): ReturnType<typeof textResult> {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      const raw = params as Record<string, unknown>;
      const actorId = assertNonEmptyString(raw["actorId"], "actorId");
      const name = assertNonEmptyString(raw["name"], "name");
      const type = (raw["type"] as string) ?? "封印物";
      const sequenceName = assertNonEmptyString(raw["sequenceName"], "sequenceName");
      const trait = (raw["trait"] as string | undefined) ?? null;

      const actor = draft.public.actors[actorId];
      if (!actor) throw new Error(`actor 不存在: ${actorId}`);

      // 1. 解析序列信息
      const lookup = getPathwayAndRank(sequenceName);
      if (!lookup) throw new Error(`未知序列名: ${sequenceName}`);
      const { pathway, rank } = lookup;

      // 2. 计算 baseValue
      const rankIndex = rankToIndex(rank);
      const baseValue = sequenceBaseline[String(rankIndex)] ?? sequenceBaseline["普通"] ?? 200;

      // 3. 生成属性
      const modifiers = generateItemStats({
        baseValue,
        itemType: type,
        itemName: name,
        sequenceName,
        trait: trait ?? undefined,
      });

      // 4. 解析标签
      const tagDef = sequenceTagsMapping[sequenceName];
      const tags = tagDef
        ? tagDef.tags.map((t) => ({ name: t, duration: tagDef.duration, stacks: 1 }))
        : [];

      // 5. 构造装备对象
      const id = createId(draft, "equip");
      const equipment: EquipmentItemData = {
        id,
        name,
        type: type as EquipmentItemData["type"],
        sequenceRank: rank,
        pathway,
        sequenceName,
        trait,
        tags,
        modifiers,
      };

      // 6. 存入背包
      (actor as unknown as { inventory: { storedEquipment: EquipmentItemData[] } }).inventory
        .storedEquipment.push(equipment);

      return equipment;
    },
    details: (result) => ({ result }),
    message: (result) => `已创建装备 ${result.name}（${result.id}）并存入 ${result.pathway} 途径的背包。`,
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

export const createEquipmentToolDefinition: FateToolDefinition = {
  name: "create_equipment",
  description:
    "创建一件装备，自动计算六维属性加成并存入 actor 背包。\n\n" +
    "需提供 actorId（装备存入的目标）、name（装备名称）、type（武器/衣物/饰品/封印物）、\n" +
    "sequenceName（序列名，决定属性权重和标签）。\n" +
    "可选 trait（特质名，影响属性分配偏向）。\n" +
    "pathway 和 rank 由系统从序列名自动解析。",
  parameters: Type.Object({
    actorId: Type.String({ description: "装备存入的目标 actorId" }),
    name: Type.String({ description: "装备名称" }),
    type: Type.String({ description: "装备类型: 武器/衣物/饰品/封印物" }),
    sequenceName: Type.String({ description: "序列名（如 占卜家/小丑/观众），决定权重和标签" }),
    trait: Type.Optional(Type.String({ description: "特质名（可选）" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    createEquipmentTool(params, ctx.sessionManager),
};