import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import { timePolicySchema } from "./time-policy-tool-schema.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import {
  assertNoOpenBackstageObligation,
  recordCanonicalTurnForBackstage,
} from "../../core/backstage/backstage-obligation.ts";
import { formatPendingHarvestReminder } from "../../core/backstage/backstage-pending.ts";
import { collectBackstageDueNotices } from "../../core/utils/faction-clock.ts";
import { assertNoOpenObligations } from "../../core/utils/obligations.ts";
import { progressSceneBeat } from "../../core/scene/scene-beat-lifecycle.ts";
import { parseSceneBeatProgressInput } from "../../core/scene/scene-beat-schema.ts";

import { runDomainEventTool } from "./domain-tool-runner.ts";

export function progressSceneBeatTool(params: unknown, sessionManager: unknown): ToolResult {
  const input = parseSceneBeatProgressInput(params, "progress_scene_beat 参数");
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      // 延迟硬阻断：上一轮触发的后台推进义务未清账则拒绝本次 canonical turn。
      assertNoOpenBackstageObligation(draft);
      const result = progressSceneBeat(draft, input);
      // canonical commit 对账点：裁决义务未清账则拒绝提交（backlog #4）
      assertNoOpenObligations(draft);
      // beat 转换是 canonical turn：收口触发后台推进义务。
      recordCanonicalTurnForBackstage(draft, {
        elapsedMinutes: input.time.elapsedMinutes,
        hasCost: true,
        beatBoundary: input.kind === "complete",
      });
      // 幕后催账：到期义务/填满时钟 + 待 harvest 的后台 run 随返回值提醒（backlog #3）
      return {
        result,
        dueNotices: collectBackstageDueNotices(draft),
        pendingReminder: formatPendingHarvestReminder(draft),
      };
    },
    details: ({ result }) => ({ result }),
    message: ({ result, dueNotices, pendingReminder }) => {
      const lines = [result.message, ...dueNotices];
      if (pendingReminder !== null) {
        lines.push(pendingReminder);
      }
      return lines.join("\n");
    },
  });
}

export const progressSceneBeatToolDefinition: FateToolDefinition = {
  name: "progress_scene_beat",
  description:
    "推进 Scene Beat lifecycle：用 begin 开启有界行动窗口，用 complete 收口当前 beat。\n\n" +
    "【使用边界】\n" +
    "- 复杂调查、潜入、对峙、撤退、战斗准备等场景用 kind=begin\n" +
    "- 当前 beat 收口、解决目标、清理威胁、可选进入 nextBeat 时用 kind=complete\n" +
    "- begin / complete 都必须填写 time\n\n" +
    "禁区：\n" +
    "- 用它记录长期目标或幕后真相\n" +
    "- 在当前无剧情窗口或无目标时强行 complete\n" +
    "- complete 后继续压入下一 foreground beat",
  parameters: Type.Object({
    kind: Type.String({ description: "begin / complete" }),
    title: Type.Optional(Type.String({ description: "begin 必填：beat 标题" })),
    objectives: Type.Optional(
      Type.Array(Type.String({ description: "begin/nextBeat 必填：1-5 个玩家可见目标" })),
    ),
    purpose: Type.Optional(Type.String({ description: "begin 必填：进入原因" })),
    outcome: Type.Optional(Type.String({ description: "complete 必填：收口结果" })),
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
        description: "complete 可选：下一 Scene Beat 对象或 null",
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
            "mundane / identity / location / affiliation / motive / ability / resource / relationship / event-cause / world-fact",
        }),
        statement: Type.String(),
        certainty: Type.String({
          description: "observed / confirmed / inferred / rumor / hypothesis",
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
    description: "daily / investigation / social / combat / ritual / escape / downtime",
  });
}
function threatSeveritySchema(): ReturnType<typeof Type.String> {
  return Type.String({ description: "low / medium / high / lethal" });
}