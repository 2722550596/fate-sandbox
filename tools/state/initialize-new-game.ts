import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { ToolResult } from "../runtime/tool-result.ts";

import { initializeNewGame } from "../../engine/core/new-game-initialization.ts";
import { parseNewGameInitializationInput } from "../../engine/core/new-game-schema.ts";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner.ts";

export function initializeNewGameTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      initializeNewGame(draft, parseNewGameInitializationInput(params, "initialize_new_game 参数")),
    details: resultDetails,
    message: (result) => result.message,
  });
}

export const initializeNewGameToolDefinition: FsnToolDefinition = {
  name: "initialize_new_game",
  description:
    "初始化新游戏 Game State 的单入口 recipe：重置 state、配置 campaign、写入 protagonist、设置在场 actor、必要时配置 protagonist 从者隐藏真名。\n\n" +
    "【必须调用的场景】\n" +
    "- /skill:start-game 已收集好时间线、玩家立场和开场身份，准备进入正式剧情前\n" +
    "- 新游戏或重新开始，需要一次性建立可运行 campaign state\n" +
    "- protagonist 是从者/非人现界者，且真名或宝具需要 hidden-canonical secret slot\n\n" +
    "【严禁的行为】\n" +
    "- 用它续局、修档或在剧情中重置后果\n" +
    "- 把 player-only 原作知识写成 public world fact\n" +
    "- protagonist 从者开局直接 public revealed 真名；未剧情内公开必须 hidden/suspected 并用 hiddenTrueName 配置 secret\n" +
    "- 用它替代后续剧情中的领域事件工具",
  parameters: Type.Object({
    kind: Type.String({ description: "human-protagonist / servant-protagonist" }),
    campaign: Type.Object({
      presetId: Type.String({
        description:
          "fsn_2004_fuyuki / fsf_2008_snowfield / extra_2032_seraph / extra_ccc_2032_far_side",
      }),
      title: Type.Optional(Type.String()),
      premise: Type.Optional(Type.String()),
      startedAt: Type.Optional(Type.String({ description: "UTC ISO instant" })),
      currentAt: Type.Optional(Type.String({ description: "UTC ISO instant" })),
      reason: Type.Optional(Type.String()),
    }),
    protagonist: Type.Unknown({
      description:
        "human: displayName/publicIdentity/background/apparentAge/outfit/demeanor；servant additionally className/trueNameDisplay/trueNameStatus(hidden|suspected)。",
    }),
    presence: Type.Optional(
      Type.Object({
        presentActorIds: Type.Array(Type.String()),
        allyActorIds: Type.Optional(Type.Array(Type.String())),
      }),
    ),
    hiddenTrueName: Type.Optional(
      Type.Object({
        value: Type.String(),
        revealConditions: Type.Array(Type.String()),
      }),
    ),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    initializeNewGameTool(params, ctx.sessionManager),
};
