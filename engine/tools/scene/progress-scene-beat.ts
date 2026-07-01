import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import {
  assertNoOpenBackstageObligation,
  recordCanonicalTurnForBackstage,
} from "../../core/backstage/backstage-obligation.ts";
import { formatPendingHarvestReminder } from "../../core/backstage/backstage-pending.ts";
import { collectBackstageDueNotices } from "../../core/backstage/faction-clock.ts";
import { assertNoOpenObligations } from "../../core/ledger/obligations.ts";
import { progressSceneBeat } from "../../core/scene/scene-beat-lifecycle.ts";
import { parseSceneBeatProgressInput } from "../../core/scene/scene-beat-schema.ts";
import { runDomainEventTool } from "../system/domain-tool-runner.ts";
import { timePolicySchema } from "./time-policy-tool-schema.ts";

export function progressSceneBeatTool(params: unknown, sessionManager: unknown): ToolResult {
  const input = parseSceneBeatProgressInput(params, "progress_scene_beat 参数");
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      if (draft.public.pendingDirectionPacket) {
        throw new Error(
          "上一轮进度已完成但尚未调用 submit_direction_packet 输出叙事。请先调 submit_direction_packet，再开启新一轮。",
        );
      }
      // 延迟硬阻断：上一轮触发的后台推进义务未清账则拒绝本次 canonical turn。
      assertNoOpenBackstageObligation(draft);
      const result = progressSceneBeat(draft, input);
      // canonical commit 对账点：complete 时必须清账，begin 放行（begin 后才可清账）
      if (input.kind === "complete") assertNoOpenObligations(draft);
      // beat 转换是 canonical turn：收口触发后台推进义务。
      recordCanonicalTurnForBackstage(draft, {
        elapsedMinutes: input.time.elapsedMinutes,
        hasCost: true,
        beatBoundary: input.kind === "complete" && draft.public.scene.threats.length > 0,
      });
      draft.public.pendingDirectionPacket = true;
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

export const progressSceneBeatToolDefinition: DomainToolDefinition = {
  name: "progress_scene_beat",
  description:
    "开启或收口一个 Scene Beat（叙事段落）。\n\nScene Beat 是「有明确目标和边界的叙事单元」——比如一场对峙、一次潜入、一场谈判、一段调查。\n用 begin 开启一段新的叙事段落，设定目标与局势；用 complete 收口它，记录结果与后续走向。\n\n【begin vs complete 字段速查】\n  kind=begin 必填：title（标题）, objectives（目标列表）, purpose（为什么进入这个 Beat）, time（时间推进）, situation（局势类型）\n  kind=complete 必填：outcome（收口结果）, time（时间推进）\n  kind=begin 可选：beatId, actionPolicy, threats, presence\n  kind=complete 可选：nextBeat（下一段叙事）, memory（战役记忆）, presence, situation\n\n【目标注意】\n- progress_scene_beat complete 会自动 resolve 当前 beat 的全部目标。不需要先用 commit_turn resolve-objective 手动标记完成。\n- 如果传了 nextBeat，新目标列表是全新的，与旧目标无关。旧目标已被自动 resolve，不会延续到新 beat。\n- 如果旧 beat 有未完成的目标线，在 outcome 文本里说明走向，或在 nextBeat.objectives 里重新描述为新的目标。\n\n【什么时候用】\n- begin：调查现场、潜入据点、与关键 NPC 对峙、撤退、准备战斗——总之需要明确目标的场景段落\n- complete：当前 Beat 的目标已经解决或不可达了，收口并记录结果；可以选传入 nextBeat 顺滑过渡到下一段\n- begin 和 complete 都必须携带 time，elapsedMinutes >= 1（即使感觉很短的互动也至少 1 分钟）\n\n【不要这样做】\n- 不要用它记录长期目标或幕后真相（那属于 offscreen 事件或秘密配置）\n- 当前没有活跃 Beat 时不要强行 complete\n- complete 之后不要在同一回复里继续推进下一个前台冲突——那属于下一轮\n- 不要在 complete 之前用 commit_turn 手动 resolve 目标——complete 会自动处理，手动 resolve 反而会因为\u201c不能解决最后一个目标\u201d而报错",
  parameters: Type.Object({
    kind: Type.String({ description: "begin / complete" }),
    title: Type.Optional(Type.String({ description: "begin 必填：beat 标题" })),
    objectives: Type.Optional(
      Type.Array(
        Type.String({ description: "begin/nextBeat 必填：这个 Beat 的目标列表，1-5 条，玩家可见" }),
      ),
    ),
    purpose: Type.Optional(
      Type.String({ description: "begin 必填：为什么要进入这个 Beat？发生了什么导致它开启？" }),
    ),
    outcome: Type.Optional(
      Type.String({ description: "complete 必填：这个 Beat 如何结束的？目标达成还是不了了之？" }),
    ),
    time: timePolicySchema(),
    beatId: Type.Optional(Type.String({ description: "可选，省略时自动生成" })),
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
          "complete 可选：收口后直接进入下一段叙事。传一个对象，包含 title, objectives, 可选 threats/presence/situation 等。传 null 表示没有下一段。",
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
    claims: Type.Optional(
      Type.Array(
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
