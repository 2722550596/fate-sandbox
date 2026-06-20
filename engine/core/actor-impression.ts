/**
 * NPC 印象卡领域逻辑（backlog #6a）。
 *
 * 公开层；per-actor impression 由 GM 蒸馏写入；
 * pre-response 注入时按 scene.presentActorIds 路由。
 */

import type { ActorImpression, State } from "./state.ts";

import { assertNonEmptyString } from "./typebox-validation.ts";

export interface UpsertActorImpressionInput {
  actorId: string;
  presence: string;
  actionStyle: string;
  relationshipPosture: string;
  voiceMaterial: string;
}

export function upsertActorImpression(
  draft: State,
  input: UpsertActorImpressionInput,
): ActorImpression {
  const actorId = assertNonEmptyString(input.actorId, "actorId");
  if (draft.public.actors[actorId] === undefined) {
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
