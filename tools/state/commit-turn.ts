import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import { timePolicySchema } from "./time-policy-tool-schema.ts";
import { commitTurn } from "../../engine/core/turn-commit.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner.ts";
import { normalizeTurnCommitInput } from "./commit-turn-normalizer.ts";

export function commitTurnTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => commitTurn(draft, normalizeTurnCommitInput(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

export const commitTurnToolDefinition: FsnToolDefinition = {
  name: "commit_turn",
  description:
    "每轮叙事结束时一次性提交本轮发生的领域事件；用于降低 GM 对多个状态工具顺序的注意力负担。\n\n" +
    "【必须调用的场景】\n" +
    "- 每次 canonical turn 都必须提交 time；等待、休息、睡眠、过夜、守夜、调查、治疗、移动都必须在顶层 time 裁决\n" +
    "- 一轮回复同时改变时间/地点、Scene Objective、伤势、物品、资金、记忆或从者资源中的多个状态\n" +
    "- 叙事已经发生购买、治疗、移动、揭示、消耗、战斗结算等 canonical Game State 变化\n" +
    "- 一轮回复同时改变非 beat lifecycle 的多个状态；Scene Beat 开启/收口必须优先用 progress_scene_beat\n" +
    "- 只覆盖当前玩家行动窗口及其直接后果；重大结算后应停止前台推进并先写足正文\n\n" +
    "【严禁的行为】\n" +
    "- 把它当裸 patch；events 必须是已有领域事件\n" +
    "- 在 events 里写时间或移动；时间与移动只写顶层 time\n" +
    "- 提交 Hidden Fact 到 Public Game State；秘密仍必须走 reveal_secret/private_resolve/record_offscreen_event\n" +
    "- 没有状态变化时为了形式调用\n" +
    "- 在同一 assistant 回复中连续提交多个前台 canonical turn，跳过玩家可回应窗口",
  parameters: Type.Object({
    summary: Type.Optional(
      Type.String({
        description: "本轮玩家可见状态变化摘要；省略时工具会从事件 reason 自动生成",
      }),
    ),
    time: timePolicySchema(),
    events: Type.Array(
      Type.Object({
        kind: Type.String({
          description:
            "领域事件类别，只允许: scene / scene-presence / actor-condition / servant-form / economy / memory。Scene Beat lifecycle 不走 commit_turn，改用 progress_scene_beat。",
        }),
        event: Type.Unknown({
          description:
            "对应领域事件载荷；scene event 不包含时间/移动，只允许 scene 态势、目标、威胁、地点修正；resolve-objective 只用于当前 GM brief 列出的目标，objectiveSummary 必须逐字复制。当前目标为无时不要使用 resolve-objective。",
        }),
      }),
    ),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    commitTurnTool(params, ctx.sessionManager),
};
