import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { EquipmentItemData, EquipmentSlots, State, StatsValues } from "../../core/state/state.ts";
import { Type } from "typebox";
import { recalculateMaxStats } from "../../core/state/stats-recalculator.ts";
import { textResult } from "../runtime/tool-result.ts";
import { runDomainEventTool } from "./domain-tool-runner.ts";
import { assertNonEmptyString } from "../../core/utils/typebox-validation.ts";

export function manageEquipmentTool(
  params: unknown,
  sessionManager: unknown,
): ReturnType<typeof textResult> {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      const raw = params as Record<string, unknown>;
      const action = raw["action"] as string | undefined;
      const actorId = assertNonEmptyString(raw["actorId"], "actorId");
      const actor = draft.public.actors[actorId];
      if (!actor) throw new Error(`actor 不存在: ${actorId}`);

      if (action === "equip") {
        return executeEquip(draft, actor, raw);
      }
      if (action === "unequip") {
        return executeUnequip(actor, raw);
      }
      throw new Error("action 必须为 equip 或 unequip");
    },
    details: (result) => ({ result }),
    message: (result) => result.message,
  });
}

interface ActionResult {
  message: string;
}

function executeEquip(
  _draft: State,
  actor: { equipment: EquipmentSlots; stats: { max: StatsValues; current: StatsValues; base: StatsValues } | null; condition: { statusEffects: readonly import("../../core/state/state.ts").StatusEffectState[] }; inventory: { storedEquipment: EquipmentItemData[] } },
  raw: Record<string, unknown>,
): ActionResult {
  const equipmentId = assertNonEmptyString(raw["equipmentId"], "equipmentId");
  const slot = assertNonEmptyString(raw["slot"], "slot") as keyof EquipmentSlots;

  if (!["weapon", "clothing", "accessory", "sealedArtifact"].includes(slot)) {
    throw new Error(`无效装备槽: ${slot}，可用: weapon/clothing/accessory/sealedArtifact`);
  }

  const idx = actor.inventory.storedEquipment.findIndex((item) => item.id === equipmentId);
  if (idx === -1) {
    throw new Error(`背包中未找到 equipmentId: ${equipmentId}`);
  }

  const item = actor.inventory.storedEquipment[idx]!;

  const typeSlotMap: Record<string, keyof EquipmentSlots> = {
    武器: "weapon",
    衣物: "clothing",
    饰品: "accessory",
    封印物: "sealedArtifact",
  };
  if (typeSlotMap[item.type] !== slot) {
    throw new Error(`装备类型 ${item.type} 不能放入 ${slot} 槽`);
  }

  if (actor.equipment[slot] !== null) {
    actor.inventory.storedEquipment.push(actor.equipment[slot]!);
  }

  actor.inventory.storedEquipment.splice(idx, 1);
  actor.equipment[slot] = item;

  if (actor.stats) {
    recalculateMaxStats(
      { base: actor.stats.base, max: actor.stats.max, current: actor.stats.current },
      actor.condition.statusEffects,
      actor.equipment,
    );
  }

  return { message: `已装备 ${item.name} 到 ${slot} 槽。` };
}

function executeUnequip(
  actor: { equipment: EquipmentSlots; stats: { max: StatsValues; current: StatsValues; base: StatsValues } | null; condition: { statusEffects: readonly import("../../core/state/state.ts").StatusEffectState[] }; inventory: { storedEquipment: EquipmentItemData[] } },
  raw: Record<string, unknown>,
): ActionResult {
  const slot = assertNonEmptyString(raw["slot"], "slot") as keyof EquipmentSlots;

  if (!["weapon", "clothing", "accessory", "sealedArtifact"].includes(slot)) {
    throw new Error(`无效装备槽: ${slot}`);
  }

  const item = actor.equipment[slot];
  if (item === null) {
    throw new Error(`${slot} 槽没有装备`);
  }

  actor.equipment[slot] = null;
  actor.inventory.storedEquipment.push(item);

  if (actor.stats) {
    recalculateMaxStats(
      { base: actor.stats.base, max: actor.stats.max, current: actor.stats.current },
      actor.condition.statusEffects,
      actor.equipment,
    );
  }

  return { message: `已卸下 ${item.name} 从 ${slot} 槽。` };
}

export const manageEquipmentToolDefinition: FateToolDefinition = {
  name: "manage_equipment",
  description:
    "管理角色装备。支持 equip（从背包装备到身上）和 unequip（从身上卸下回背包）。\n\n" +
    "equip 时需提供 equipmentId（背包中的装备 ID）和 slot（weapon/clothing/accessory/sealedArtifact）。\n" +
    "装备后会重新计算 actor.stats.max（叠加装备 modifiers）。\n" +
    "unequip 时只需提供 slot。",
  parameters: Type.Object({
    action: Type.String({ description: "操作: equip / unequip" }),
    actorId: Type.String({ description: "目标 actorId" }),
    equipmentId: Type.Optional(Type.String({ description: "equip 时必填：背包中的装备 ID" })),
    slot: Type.String({ description: "装备槽: weapon / clothing / accessory / sealedArtifact" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    manageEquipmentTool(params, ctx.sessionManager),
};