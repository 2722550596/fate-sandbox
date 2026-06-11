import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import { timePolicySchema } from "./time-policy-tool-schema.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { progressSceneBeat } from "../../engine/core/scene-beat-lifecycle.ts";
import { parseSceneBeatProgressInput } from "../../engine/core/scene-beat-schema.ts";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner.ts";

export function progressSceneBeatTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      progressSceneBeat(draft, parseSceneBeatProgressInput(params, "progress_scene_beat 参数")),
    details: resultDetails,
    message: (result) => result.message,
  });
}

export const progressSceneBeatToolDefinition: FsnToolDefinition = {
  name: "progress_scene_beat",
  description:
    "推进当前 Scene Beat lifecycle；这是 Scene Beat 的唯一 GM-facing Adapter，用 begin 开启有界行动窗口，用 complete 收口当前 beat（失败、撤退、逃离也属于 complete）。\n\n" +
    "【必须调用的场景】\n" +
    "- 进入新的调查、潜入、对峙、撤退、战斗准备等复杂场景，需要 1-5 个当前目标：kind=begin\n" +
    "- 当前 GM brief 显示存在剧情窗口，且当前 beat 已经收口，需要一次性解决全部 active Scene Objective、清理 Scene Threat、可选记录 Campaign Memory、可选进入 nextBeat：kind=complete\n" +
    "- 进入或收口 beat 时必须填写 time；移动用 time.kind=travel；非移动事件用 time.kind=elapsed，最小 1 分钟\n" +
    "- begin 或 complete 形成新的玩家行动窗口后，应停止继续游玩下一窗口，先输出足量场景正文\n\n" +
    "【严禁的行为】\n" +
    "- 用它记录长期目标或幕后真相；长期后果写 memory，秘密走 reveal/private_resolve/offscreen\n" +
    "- 当前 GM brief 显示剧情窗口未设定或当前目标为无时调用 complete\n" +
    "- 未满足当前 completionCriteria 就强行 complete；失败/撤退可以 complete，但 outcome 必须写明代价或后果\n" +
    "- nextBeat 继续复读同一中心冲突：撤退/逃亡完成后必须转为落脚、治疗、隐蔽、休整、交涉或新信息处理\n" +
    "- 用 memory 写入未揭示 secret；公开记忆仍必须提供 claims 并遵守证据门禁\n" +
    "- 手写 set-story-window/add-objective 或 commit_turn scene-beat AST 来绕过 Scene Beat lifecycle\n" +
    "- complete 后立刻继续结算下一 foreground beat，把多个可回应窗口压进一条最终回复",
  parameters: Type.Object({
    kind: Type.String({ description: "允许: begin / complete" }),
    title: Type.Optional(Type.String({ description: "begin 必填：Scene Beat 标题" })),
    objectives: Type.Optional(
      Type.Array(
        Type.String({ description: "begin/nextBeat 必填：1-5 个玩家可见 Scene Objective" }),
      ),
    ),
    purpose: Type.Optional(Type.String({ description: "begin 必填：为什么进入这个 beat" })),
    outcome: Type.Optional(Type.String({ description: "complete 必填：当前 beat 收口结果" })),
    time: timePolicySchema(),
    beatId: Type.Optional(Type.String({ description: "可选；begin 省略时自动生成" })),
    actionPolicy: Type.Optional(sceneBeatActionPolicySchema()),
    threats: Type.Optional(
      Type.Array(
        Type.Object({
          summary: Type.String(),
          severity: threatSeveritySchema(),
        }),
      ),
    ),
    presence: Type.Optional(sceneBeatPresenceSchema()),
    situation: Type.Optional(situationSchema()),
    memory: Type.Optional(sceneBeatMemorySchema()),
    nextBeat: Type.Optional(
      Type.Unknown({
        description:
          "complete 可选：下一 Scene Beat 对象或 null；对象可含 title/objectives/beatId/actionPolicy/threats/presence/situation。",
      }),
    ),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    progressSceneBeatTool(params, ctx.sessionManager),
};

function sceneBeatActionPolicySchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    allowedActions: Type.Optional(Type.Array(Type.String())),
    forbiddenEscalations: Type.Optional(Type.Array(Type.String())),
    completionCriteria: Type.Optional(Type.Array(Type.String())),
    nextBeatHints: Type.Optional(Type.Array(Type.String())),
  });
}
function sceneBeatPresenceSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    presentActorIds: Type.Optional(Type.Array(Type.String())),
    allyActorIds: Type.Optional(Type.Array(Type.String())),
  });
}
function sceneBeatMemorySchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    title: Type.String(),
    summary: Type.String(),
    consequences: Type.Optional(Type.Array(Type.String())),
    claims: Type.Array(
      Type.Object({
        kind: Type.String({
          description:
            "claim 类型，允许: mundane / identity / location / affiliation / motive / ability / resource / relationship / event-cause / world-fact",
        }),
        statement: Type.String(),
        certainty: Type.String({
          description: "证据确信度，允许: observed / confirmed / inferred / rumor / hypothesis",
        }),
        subjectId: Type.Optional(Type.String()),
        relatedSecretSlotIds: Type.Optional(Type.Array(Type.String())),
        evidence: Type.Optional(Type.String()),
      }),
    ),
  });
}
function situationSchema(): ReturnType<typeof Type.String> {
  return Type.String({
    description:
      "场景类型，允许: daily / investigation / social / combat / ritual / escape / downtime",
  });
}
function threatSeveritySchema(): ReturnType<typeof Type.String> {
  return Type.String({ description: "威胁等级，允许: low / medium / high / lethal" });
}