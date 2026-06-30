import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { recordActing } from "../../core/actor/acting.ts";
import { parseActingEvent } from "../../core/actor/actor-schema.ts";
import {
  INTENSITY_LEVEL_SCHEMA,
  NARRATIVE_WEIGHT_LEVEL_SCHEMA,
} from "../../core/state/state-enum-schemas.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { resultDetails, runDomainEventTool } from "../system/domain-tool-runner.ts";

export function recordActingFeedbackTool(params: unknown, sessionManager: unknown): ToolResult {
  const event = parseActingEvent(
    isRecord(params) ? { kind: "advance-acting", ...params } : params,
    "record_acting_feedback",
  );

  return runDomainEventTool({
    sessionManager,
    execute: (draft) => recordActing(draft, event),
    details: resultDetails,
    message: (result) => result.message,
  });
}

const CUE_INPUT_SCHEMA = Type.Object({
  key: Type.String({ minLength: 1, description: "扮演行为维度标识（如 fortune-telling）" }),
  label: Type.String({ minLength: 1, description: "行为显示名（如 占卜与预言）" }),
  intensity: INTENSITY_LEVEL_SCHEMA,
  narrativeWeight: NARRATIVE_WEIGHT_LEVEL_SCHEMA,
});

export const recordActingFeedbackToolDefinition: DomainToolDefinition = {
  name: "record_acting_feedback",
  description:
    "记录扮演反馈。追加一条或多条扮演行为记录到 actor 的 actingCues 日志。\n\n" +
    "每次 record_acting_feedback 的 cues 数组中的每条 cue 由三个字段构成：\n" +
    "- intensity（扮演深度）：cursory=浅尝辄止 / moderate=适度扮演 / deep=深入扮演 / pivotal=决定性扮演\n" +
    "- narrativeWeight（叙事密度）：casual=日常无观众 / witnessed=有目击者 / significant=有代价/风险 / fateful=改变剧情走向\n" +
    "- key / label：行为维度标识和显示名\n\n" +
    "引擎自动根据每条 cue 的 intensity + narrativeWeight 计算加权总分，\n" +
    "并检查最早扮演记录距今是否 ≥1 个月，综合判断消化状态。\n\n" +
    "使用边界：GM 在叙事中看到角色做出了符合当前序列扮演法的行为后记录。\n\n" +
    "禁区：用此工具代替叙事判断角色行为是否「符合扮演法」——\n" +
    "引擎不判断正确性，只记录 GM 认定有效的扮演行为。",
  parameters: Type.Object({
    actorId: Type.String({ minLength: 1, description: "目标 actor id" }),
    cues: Type.Array(CUE_INPUT_SCHEMA, {
      minItems: 1,
      description: "本次记录的扮演行为列表",
    }),
    reason: Type.String({ minLength: 1, description: "本次扮演推进的叙事依据" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    recordActingFeedbackTool(params, ctx.sessionManager),
};
