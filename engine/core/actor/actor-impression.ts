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
 * 格式化 presence 驱动的角色印象卡片段，供两端使用：
 *
 * - 渲染器（Pass B）：通过 runtime:renderer-presence-impressions 调用，
 *   外层由 buildRendererPresenceImpressionsText 包裹干净指引。
 * - 结算器（Pass A）：通过 runtime:presence-impressions 调用，
 *   外层由 buildPresenceImpressionsText 包裹结算器指引 + 追加 GM 专属字段。
 *
 * 本函数只输出对渲染器安全的表面字段：
 *   impression: presence / actionStyle / relationshipPosture / voiceMaterial
 *   actor:      publicIdentity / apparentAge / outfit / demeanor / stance
 *
 * GM 专属的深层字段（background / lockedFacts / inventory / abilities /
 * condition / sequence 等）由结算器端的包装函数追加。
 */
export function formatPresenceImpressionCards(state: State): string | null {
  const cards = presentActorImpressions(state);
  if (cards.length === 0) return null;
  const lines: string[] = [];
  for (const card of cards) {
    const actor = state.public.actors[card.actorId];
    const name = actor?.presentation.renderName ?? card.actorId;
    const identity = actor?.identity.publicIdentity;
    const age = actor?.presentation.apparentAge;
    const outfit = actor?.presentation.outfit;
    const demeanor = actor?.presentation.demeanor;
    const stance = actor?.relationshipToProtagonist.stance;

    lines.push(`【${name}】`);
    if (identity !== undefined && identity.length > 0) {
      lines.push(`  身份：${identity}`);
    }
    if (age !== undefined && age.length > 0) {
      lines.push(`  外表年龄：${age}`);
    }
    if (outfit !== undefined && outfit.label.length > 0) {
      const outfitLine =
        outfit.details.length > 0 ? `${outfit.details}（${outfit.label}）` : outfit.label;
      lines.push(`  外貌：${outfitLine}`);
    }
    if (demeanor !== undefined && demeanor.length > 0) {
      lines.push(`  风范：${demeanor}`);
    }
    if (stance !== undefined && stance.length > 0) {
      lines.push(`  立场：${stance}`);
    }
    lines.push(
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
 * 为结算器追加 GM 专属的 actor 深层字段。
 * 给 formatPresenceImpressionCards 的输出追加每张卡对应的
 * roles、inventory.items、background、lockedFacts、abilities、condition、sequence。
 */
export function formatSettlementImpressionExtra(state: State): string {
  const cards = presentActorImpressions(state);
  if (cards.length === 0) return "";
  const lines: string[] = [];
  for (const card of cards) {
    const actor = state.public.actors[card.actorId];
    if (actor === undefined) continue;
    const name = actor.presentation.renderName;
    const secretActor = state.secrets.actorStates[card.actorId];
    const sub: string[] = [];
    if (secretActor?.secrets !== undefined) {
      const s = secretActor.secrets;
      const secretCounts: string[] = [];
      const icons: Record<string, string> = { hidden: "🔒", foreshadowed: "🔮", revealed: "✅" };
      for (const [label, slots] of [
        ["非凡", s.beyonderSecrets],
        ["动机", s.privateMotives],
        ["关联", s.unrevealedAffiliations],
      ] as const) {
        const counts = new Map<string, number>();
        for (const slot of slots) {
          const key = icons[slot.revealState] ?? "❓";
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        for (const [icon, count] of counts) {
          secretCounts.push(`${label}${icon}${count}`);
        }
      }
      if (secretCounts.length > 0) {
        sub.push(`秘密：${secretCounts.join(" ")}`);
      }
    }

    if (actor.identity.roles.length > 0) {
      sub.push(`社会角色：${actor.identity.roles.join("、")}`);
    }
    if (actor.inventory.items.length > 0) {
      sub.push(`随身物品：${actor.inventory.items.join("、")}`);
    }
    if (actor.identity.background.length > 0) {
      sub.push(`背景：${actor.identity.background}`);
    }
    const extraFacts = actor.identity.lockedFacts.filter((fact) => fact.id !== "setup-identity");
    if (extraFacts.length > 0) {
      sub.push(`记录：${extraFacts.map((fact) => fact.text).join("；")}`);
    }
    if (actor.abilities.length > 0) {
      sub.push(`能力：${actor.abilities.map((a) => `${a.label}：${a.summary}`).join("；")}`);
    }
    if (actor.condition.afflictions.length > 0) {
      sub.push(
        `状态：${actor.condition.afflictions
          .map((a) => {
            const base = `${a.source}:${a.text}`;
            return a.expectedDuration !== null ? `${base}（预期${a.expectedDuration}）` : base;
          })
          .join("；")}`,
      );
    }
    const seq = actor.sequence;
    if (seq !== null) {
      const seqParts: string[] = [seq.currentSequence, `途径${seq.pathway}`];
      if (typeof seq.rank === "string" && seq.rank.length > 0) {
        seqParts.push(`等级${seq.rank}`);
      }
      if (typeof seq.promotionSystem === "string" && seq.promotionSystem.length > 0) {
        seqParts.push(`晋升${seq.promotionSystem}`);
      }
      sub.push(`序列：${seqParts.join(" / ")}`);
    }
    if (sub.length > 0) {
      lines.push(`  [GM] ${name}：${sub.join("；")}`);
    }
  }
  return lines.join("\n");
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
