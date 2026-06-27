/**
 * NPC 印象卡领域逻辑（backlog #6a）。
 *
 * 公开层；per-actor impression 由 GM 蒸馏写入；
 * pre-response 注入时按 scene.presentActorIds 路由。
 */

import type { ActorImpression, OutfitState, State } from "../state/state.ts";

import { assertNonEmptyString } from "../utils/typebox-validation.ts";

export interface UpsertActorImpressionInput {
  actorId: string;
  presence: string;
  actionStyle: string;
  relationshipPosture: string;
  voiceMaterial: string;
  /** 可选：更新 actor 的正文固定用名 */
  renderName?: string;
}

export function upsertActorImpression(
  draft: State,
  input: UpsertActorImpressionInput,
): ActorImpression {
  const actorId = assertNonEmptyString(input.actorId, "actorId");
  const actor = draft.public.actors[actorId];
  if (actor === undefined) {
    throw new Error(`actor ${actorId} 不存在，无法写入 impression。`);
  }
  const card: ActorImpression = {
    actorId,
    presence: assertNonEmptyString(input.presence, "presence"),
    actionStyle: assertNonEmptyString(input.actionStyle, "actionStyle"),
    relationshipPosture: assertNonEmptyString(input.relationshipPosture, "relationshipPosture"),
    voiceMaterial: assertNonEmptyString(input.voiceMaterial, "voiceMaterial"),
    updatedAt: draft.public.clock.currentAt,
  };
  draft.public.actorImpressions[actorId] = card;
  if (input.renderName !== undefined) {
    actor.presentation.renderName = assertNonEmptyString(input.renderName, "renderName");
  }
  return card;
}

/**
 * 返回当前 scene presence 中有印象卡的 actor 卡片（注入用）。
 */
export function presentActorImpressions(state: State): ActorImpression[] {
  return state.public.scene.presentActorIds
    .map((actorId) => state.public.actorImpressions[actorId])
    .filter((card): card is ActorImpression => card !== undefined);
}

/**
 * 格式化 presence 驱动的 NPC 印象卡片段（注入 pre-response slot）。
 */
export function formatPresenceImpressionCards(state: State): string | null {
  const cards = presentActorImpressions(state);
  if (cards.length === 0) return null;
  const lines: string[] = [];
  for (const card of cards) {
    const name = state.public.actors[card.actorId]?.presentation.renderName ?? card.actorId;
    lines.push(
      `【${name}】`,
      `  气场：${card.presence}`,
      `  行动风格：${card.actionStyle}`,
      `  对主角姿态：${card.relationshipPosture}`,
    );
    if (card.voiceMaterial.length > 0) {
      lines.push(`  语癖/对话范例：${card.voiceMaterial}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/**
 * 更新 actor 的 outfit（外观/装备）。
 */
export function changeActorOutfit(
  draft: State,
  actorId: string,
  outfit: OutfitState,
  reason: string,
): { message: string } {
  assertNonEmptyString(reason, "reason");
  const actor = draft.public.actors[actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${actorId}`);
  }
  actor.presentation.outfit = outfit;
  return { message: "外观装备已更新。" };
}
