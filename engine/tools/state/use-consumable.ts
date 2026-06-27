import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";

import { calculateCorruptionBacklash } from "../../core/equipment/consumable-stats.ts";
import { sequenceRankToIndex } from "../../core/combat/sequence-utils.ts";
import { recalculateMaxStats } from "../../core/state/stats-recalculator.ts";
import { textResult } from "../runtime/tool-result.ts";
import { runDomainEventTool } from "./domain-tool-runner.ts";
import { assertNonEmptyString } from "../../core/utils/typebox-validation.ts";

export function useConsumableTool(
  params: unknown,
  sessionManager: unknown,
): ReturnType<typeof textResult> {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      const raw = params as Record<string, unknown>;
      const actorId = assertNonEmptyString(raw["actorId"], "actorId");
      const consumableId = assertNonEmptyString(raw["consumableId"], "consumableId");

      const actor = draft.public.actors[actorId];
      if (!actor) throw new Error(`actor 不存在: ${actorId}`);

      const inv = actor.inventory;
      const idx = inv.consumables.findIndex((c) => c.id === consumableId);
      if (idx === -1) throw new Error(`背包中未找到消耗品: ${consumableId}`);

      const item = inv.consumables[idx]!;
      if (item.quantity <= 0) throw new Error(`消耗品 ${item.name} 数量不足`);

      // 1. 应用属性变化到 actor.stats.current
      if (actor.stats && item.statChanges) {
        for (const [attr, delta] of Object.entries(item.statChanges)) {
          const key = attr as keyof typeof actor.stats.current;
          if (key in actor.stats.current) {
            const newVal = (actor.stats.current[key] ?? 0) + delta;
            actor.stats.current[key] = Math.max(0, newVal);
          }
        }
        // 重算 max（确保 current 被钳制）
        recalculateMaxStats(
          actor.stats,
          actor.condition.statusEffects,
          actor.equipment,
        );
      }

      // 2. 杀伤型：添加伤害加成作为临时状态效果
      if (item.effect === "杀伤" && item.damageBonus && item.damageBonus > 0) {
        actor.condition.statusEffects.push({
          id: `effect-consumable-${Date.now()}`,
          name: `${item.name}伤害加成`,
          type: "buff",
          affectedAttribute: item.sourceAttribute ?? "vitality",
          valueType: "fixed",
          value: item.damageBonus,
          duration: 1,
          source: `consumable:${item.name}`,
        });
      }

      // 3. 计算失控反噬
      if (actor.sequence) {
        const playerRankIndex = sequenceRankToIndex(actor.sequence.rank);
        const itemRankIndex = sequenceRankToIndex(item.sequenceRank);
        const backlash = calculateCorruptionBacklash(playerRankIndex, itemRankIndex, item.type);
        if (backlash > 0) {
          actor.sequence.lossOfControlProgress = Math.min(
            100,
            actor.sequence.lossOfControlProgress + backlash,
          );
        }
      }

      // 4. 减少数量 / 移除
      item.quantity -= 1;
      if (item.quantity <= 0) {
        inv.consumables.splice(idx, 1);
      }

      const changes = item.statChanges
        ? Object.entries(item.statChanges)
            .filter(([, v]) => v !== 0)
            .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`)
            .join(", ")
        : "无";

      return { message: `使用了 ${item.name}（${changes}）` };
    },
    details: (result) => ({ result }),
    message: (result) => result.message,
  });
}

export const useConsumableToolDefinition: FateToolDefinition = {
  name: "use_consumable",
  description:
    "使用一个消耗品。自动应用属性修正（statChanges）到 actor.stats.current，\n" +
    "杀伤型消耗品会添加临时伤害加成效果，越级使用消耗品会增加失控值。\n\n" +
    "使用后消耗品数量减 1，归零时自动从背包移除。",
  parameters: Type.Object({
    actorId: Type.String({ description: "使用者的 actorId" }),
    consumableId: Type.String({ description: "消耗品 ID（inventory.consumables 中的 id）" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    useConsumableTool(params, ctx.sessionManager),
};