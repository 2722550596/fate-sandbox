import type { FateToolDefinition } from "../runtime/tool-definition.ts";
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

export const initializeNewGameToolDefinition: FateToolDefinition = {
  name: "initialize_new_game",
  description:
    "初始化新游戏 Game State 的单入口 recipe：重置 state、配置 campaign、写 protagonist、设在场 actor、必要时配 protagonist 从者隐藏真名。\n\n" +
    "【使用边界】\n" +
    "- /skill:start-game 已定好时间线/立场/开场身份，进正式剧情前一次性建立可运行 state\n" +
    "- protagonist 是从者/非人现界者且真名/宝具需 hidden-canonical secret slot\n\n" +
    "【严禁】\n" +
    "- 用它续局、修档或剧情中重置后果\n" +
    "- 把 player-only 原作知识写成 public world fact\n" +
    "- protagonist 从者开局直接 public revealed 真名（未公开必须 hidden/suspected + hiddenTrueName secret）\n" +
    "- 用它替代后续领域事件工具",
  parameters: Type.Object({
    kind: Type.String({ description: "human-protagonist / servant-protagonist" }),
    campaign: Type.Object({
      presetId: Type.String({
        description:
          "fsn_2004_fuyuki / fz_1994_fuyuki / ha_2004_fuyuki / fsf_2008_snowfield / apocrypha_2004_trifas / extra_2032_seraph / extra_ccc_2032_far_side / case_files_2003_london / tsukihime_2000_misaki / tsukihime_2021_souya / knk_1998_mifune / mahoyo_1989_misaki / custom_worldline",
      }),
      title: Type.Optional(Type.String()),
      premise: Type.Optional(Type.String()),
      startedAt: Type.Optional(Type.String({ description: "UTC ISO instant" })),
      currentAt: Type.Optional(Type.String({ description: "UTC ISO instant" })),
      reason: Type.Optional(Type.String()),
    }),
    protagonist: Type.Unknown({
      description:
        "human: internalName/renderName/publicIdentity/background/apparentAge/outfit/demeanor；servant additionally className/trueNameDisplay/trueNameStatus(hidden|suspected)。renderName 是正文固定用名，中文名优先。",
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
        revealConditions: Type.Array(
          Type.String({
            description:
              "可被后续 reveal_secret 的 claim/trigger/evidence 字面命中的短线索词；不要写整句判定条件。例：直死之魔眼 / 死亡线 / 自报姓名 / 両儀式",
          }),
        ),
      }),
    ),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    initializeNewGameTool(params, ctx.sessionManager),
};
