import type { Static } from "typebox";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { stringEnumSchema } from "../core/state-enum-schemas.ts";
import { isRecord, parseTypeBoxValue, trimStringsDeep } from "../core/typebox-validation.ts";

/**
 * Direction Packet：双 pass 架构（backlog #12）中结算器 → 渲染器的唯一通道。
 * 接缝契约已由 docs/spike-two-pass/ 验证（GO）。
 *
 * 分层语义：
 * - binding（playerAction / resolvedChanges / endWindow）：渲染器必须落地，不得改写。
 * - free（sensoryAnchors / npcStances）：质感建议，渲染器可自由取舍。
 * - needsRender=false 的轮（meta/OOC）跳过渲染，直接回复 directReply。
 */

export const EVENT_WEIGHTS = ["light", "normal", "heavy"] as const;
export type EventWeight = (typeof EVENT_WEIGHTS)[number];

export const NPC_STANCE_SCHEMA = Type.Object({
  actorId: Type.String({ minLength: 1 }),
  stance: Type.String({ minLength: 1 }),
  wants: Type.String({ minLength: 1 }),
  /** 该角色本轮绝不说出口的内容。只描述「拒说什么」，禁止把秘密本体写进来。 */
  refusesToSay: Type.String({ minLength: 1 }),
});
export type NpcStance = Static<typeof NPC_STANCE_SCHEMA>;

export const SUGGESTED_ACTION_SCHEMA = Type.Object({
  submitText: Type.String({ minLength: 1 }),
});
export type SuggestedAction = Static<typeof SUGGESTED_ACTION_SCHEMA>;

export const RENDER_DIRECTION_PACKET_SCHEMA = Type.Object({
  needsRender: Type.Literal(true),
  /** 结算后的玩家行动认定（binding） */
  playerAction: Type.String({ minLength: 1 }),
  /** 已结算机械事实，每条必须在正文落地（binding） */
  resolvedChanges: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  npcStances: Type.Array(NPC_STANCE_SCHEMA),
  /** 建议落点意象（free） */
  sensoryAnchors: Type.Array(Type.String({ minLength: 1 })),
  /** 结尾必须落在自然接续点（binding） */
  endWindow: Type.String({ minLength: 1 }),
  eventWeight: stringEnumSchema(EVENT_WEIGHTS),
  /** 渲染所需 canon 预填；渲染器不得超出它编造原作设定 */
  canonFacts: Type.Array(Type.String({ minLength: 1 })),
  /** UI 层候选行动，不进入正文；extension 可把 submitText 作为真正 user message 发出 */
  suggestedActions: Type.Optional(
    Type.Array(SUGGESTED_ACTION_SCHEMA, { minItems: 1, maxItems: 4 }),
  ),
});
export type RenderDirectionPacket = Static<typeof RENDER_DIRECTION_PACKET_SCHEMA>;

export const DIRECT_REPLY_PACKET_SCHEMA = Type.Object({
  needsRender: Type.Literal(false),
  /** meta/OOC 轮直接回复玩家的内容，不经渲染器 */
  directReply: Type.String({ minLength: 1 }),
});
export type DirectReplyPacket = Static<typeof DIRECT_REPLY_PACKET_SCHEMA>;

export type DirectionPacket = RenderDirectionPacket | DirectReplyPacket;

const RENDER_PACKET_VALIDATOR = Compile(RENDER_DIRECTION_PACKET_SCHEMA);
const DIRECT_REPLY_VALIDATOR = Compile(DIRECT_REPLY_PACKET_SCHEMA);

export function parseDirectionPacket(value: unknown, fieldName: string): DirectionPacket {
  const trimmed = trimStringsDeep(value);
  if (!isRecord(trimmed)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  const needsRender = trimmed["needsRender"];
  if (typeof needsRender !== "boolean") {
    throw new Error(`非法 ${fieldName}.needsRender: 必须是布尔值（true=渲染轮，false=直答轮）。`);
  }
  return needsRender
    ? parseTypeBoxValue(trimmed, fieldName, RENDER_PACKET_VALIDATOR)
    : parseTypeBoxValue(trimmed, fieldName, DIRECT_REPLY_VALIDATOR);
}
