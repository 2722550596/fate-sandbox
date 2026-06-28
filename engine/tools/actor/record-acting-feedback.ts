import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { parseActingEvent } from "../../core/actor/acting-schema.ts";
import { recordActing } from "../../core/actor/acting.ts";
import { resultDetails, runDomainEventTool } from "../system/domain-tool-runner.ts";

export function recordActingFeedbackTool(params: unknown, sessionManager: unknown): ToolResult {
  const event = parseActingEvent(params, "record_acting_feedback");

  return runDomainEventTool({
    sessionManager,
    execute: (draft) => recordActing(draft, event),
    details: resultDetails,
    message: (result) => result.message,
  });
}

export const recordActingFeedbackToolDefinition: DomainToolDefinition = {
  name: "record_acting_feedback",
  description:
    "记录扮演反馈。追加一条或多条扮演行为记录到 actor 的 actingCues 日志。\n\n" +
    "每次 record_acting_feedback 追加的 cue 数量反映扮演的推进度：\n" +
    "- 6 条累计 ≈ 消化过半\n" +
    "- 10 条累计 ≈ 晋升门槛\n" +
    "- 12 条累计 ≈ 完全消化\n" +
    "（条数为参考，GM 根据叙事密度和扮演深度自行判断）\n\n" +
    "使用边界：GM 在叙事中看到角色做出了符合当前序列扮演法的行为后记录。\n\n" +
    "禁区：用此工具代替叙事判断角色行为是否「符合扮演法」——\n" +
    "引擎不判断正确性，只记录 GM 认定有效的扮演行为。",
  parameters: Type.Object({
    actorId: Type.String({ minLength: 1, description: "目标 actor id" }),
    cues: Type.Array(
      Type.Object({
        key: Type.String({ minLength: 1, description: "扮演行为维度标识（如 fortune-telling）" }),
        label: Type.String({ minLength: 1, description: "行为显示名（如 占卜与预言）" }),
      }),
      { minItems: 1, description: "本次记录的扮演行为列表" },
    ),
    reason: Type.String({ minLength: 1, description: "本次扮演推进的叙事依据" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    recordActingFeedbackTool(params, ctx.sessionManager),
};
