import type { FsnToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { collectUnrevealedSecretStrings } from "../../engine/audit/lint-rules.ts";
import { scanDirectionPacket } from "../../engine/direction/packet-firewall.ts";
import {
  type DirectionPacket,
  EVENT_WEIGHTS,
  parseDirectionPacket,
} from "../../engine/direction/packet-schema.ts";
import { SUBMIT_DIRECTION_PACKET_TOOL } from "../../engine/direction/render-turn.ts";
import { stringEnumSchema } from "../../engine/core/state-enum-schemas.ts";
import { getState } from "../../engine/core/state-store.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

/**
 * 双 pass 收尾工具：验证 direction packet、过 secret 防火墙，terminate 结束
 * 结算循环；渲染由 two-pass-render 扩展在 agent_end 接手。本工具不改 state。
 */
export function submitDirectionPacketTool(params: unknown): ToolResult & { terminate: true } {
  const packet = parseDirectionPacket(params, "direction packet");
  const verdict = scanDirectionPacket(packet, collectUnrevealedSecretStrings(getState().secrets));
  if (verdict.kind === "blocked") {
    const paths = verdict.findings
      .map((finding) => `${finding.path}（泄漏「${finding.secret}」）`)
      .join("、");
    throw new Error(
      `direction packet 被 secret 防火墙拦截：${paths}。` +
        "渲染器不得接触未揭示秘密；请改写这些字段，只描述玩家可感知的表象，或先用 reveal_secret 正式揭示。",
    );
  }
  return { ...textResult(formatAccepted(packet), { packet }), terminate: true };
}

function formatAccepted(packet: DirectionPacket): string {
  if (!packet.needsRender) {
    return "direction packet 已接收（直答轮）：directReply 将原样回复玩家。";
  }
  const suggestedActionCount = packet.suggestedActions?.length ?? 0;
  return [
    "direction packet 已接收并通过 secret 防火墙，本轮结算结束。",
    `binding 事实 ${packet.resolvedChanges.length} 条 / NPC 立场 ${packet.npcStances.length} 条 / UI 候选 ${suggestedActionCount} 条 / 篇幅 ${packet.eventWeight}。`,
    "渲染器将接手产出玩家可见正文。",
  ].join("\n");
}

export const submitDirectionPacketToolDefinition: FsnToolDefinition = {
  name: SUBMIT_DIRECTION_PACKET_TOOL,
  description:
    "提交本轮 direction packet 并结束结算。这是每轮唯一的收尾动作。\n\n" +
    "【必须调用的场景】\n" +
    "- 本轮全部领域工具结算完成之后，一轮恰好一次\n" +
    "- meta/OOC 轮用 needsRender=false + directReply 直接作答\n\n" +
    "【严禁的行为】\n" +
    "- 在调用前后输出叙事正文（玩家看不到，渲染器也看不到）\n" +
    "- 把未揭示真名/隐藏宝具名写进任何字段（防火墙会整包拒绝）\n" +
    "- 用它替代领域工具落账：时间/伤势/金钱/揭示必须先用对应工具结算\n" +
    "- 把 UI 候选行动写进 endWindow 或正文；候选只能放 suggestedActions，且 submitText 必须是给玩家完整显示的自然输入，不得压缩",
  parameters: Type.Object({
    needsRender: Type.Boolean({
      description: "true=叙事轮（渲染器产出正文）；false=meta/OOC 直答轮",
    }),
    playerAction: Type.Optional(
      Type.String({ description: "binding：结算后认定并主动演出的玩家意图（叙事轮必填）" }),
    ),
    resolvedChanges: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "binding：本轮全部已结算机械事实，每条一句话；漏写=玩家看不到（叙事轮必填，至少 1 条）",
      }),
    ),
    npcStances: Type.Optional(
      Type.Array(
        Type.Object({
          actorId: Type.String(),
          stance: Type.String({ description: "行为基调" }),
          wants: Type.String({ description: "本轮驱动其主动行为的欲望" }),
          refusesToSay: Type.String({
            description: "绝不说出口的话题；只描述拒说什么，严禁写入秘密本体",
          }),
        }),
        { description: "player-safe：在场重要 NPC 每人一条（叙事轮必填，可为空数组）" },
      ),
    ),
    sensoryAnchors: Type.Optional(
      Type.Array(Type.String(), { description: "free：3-5 条建议落点意象，渲染器可取舍" }),
    ),
    endWindow: Type.Optional(
      Type.String({ description: "binding：结尾必须落在自然接续点（叙事轮必填）" }),
    ),
    eventWeight: Type.Optional(stringEnumSchema(EVENT_WEIGHTS)),
    suggestedActions: Type.Optional(
      Type.Array(
        Type.Object({
          submitText: Type.String({
            description:
              "作为真正 user message 发送并完整显示给玩家的自然玩家输入；不得压缩、不得写机械编号文本",
          }),
        }),
        {
          minItems: 1,
          maxItems: 4,
          description:
            "可选：玩家下一步候选行动。只给 UI 使用，不进入正文；候选显示 submitText 全文，禁止压缩",
        },
      ),
    ),
    canonFacts: Type.Optional(
      Type.Array(Type.String(), {
        description: "渲染所需原作事实预填；渲染器没有 lookup，缺位它就会编（叙事轮必填，可为空数组）",
      }),
    ),
    directReply: Type.Optional(
      Type.String({ description: "直答轮的回复内容（needsRender=false 时必填）" }),
    ),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, _ctx) =>
    submitDirectionPacketTool(params),
};
