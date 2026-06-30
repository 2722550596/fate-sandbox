import type { BackstageResolutionInput } from "../../core/backstage/backstage-obligation.ts";
import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { settleOldestBackstageObligation } from "../../core/backstage/backstage-obligation.ts";
import { assertNoUnharvestedPending } from "../../core/backstage/backstage-pending.ts";
import { assertOneOfString } from "../../core/utils/string-enum.ts";
import { assertNonEmptyString, isRecord } from "../../core/utils/typebox-validation.ts";
import { runDomainEventTool } from "../system/domain-tool-runner.ts";

const RESOLUTION_OUTCOMES = ["no-change", "blocked"] as const;
const RESOLUTION_REASON_CODES = [
  "advanced-recently",
  "no-line-in-window",
  "actors-on-scene",
  "beat-forbids-backstage",
  "blocked-by-canon",
] as const;

export function resolveBackstageLineTool(params: unknown, sessionManager: unknown): ToolResult {
  const input = parseInput(params);
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      // 拦住 footgun：有已起但未 harvest 的 run 时，不准用 no-change 清账丢弃已产出的候选。
      assertNoUnharvestedPending(draft);
      const settled = settleOldestBackstageObligation(draft, input);
      if (settled === undefined) {
        throw new Error("当前没有未清账的后台世界推进义务，无需 resolve_backstage_line。");
      }
      return { settled, input };
    },
    details: ({ settled }) => ({ obligationId: settled.id }),
    message: ({ settled, input: resolved }) =>
      `后台世界推进义务已清账（${resolved.outcome}）：${settled.summary}\n- ${resolved.reasonCode}：${resolved.note}`,
  });
}

function parseInput(params: unknown): BackstageResolutionInput {
  if (!isRecord(params)) {
    throw new Error("resolve_backstage_line 参数必须是对象。");
  }
  const outcome = assertOneOfString(params["outcome"], RESOLUTION_OUTCOMES, "outcome", {
    style: "must-be",
  });
  const reasonCode = assertOneOfString(
    params["reasonCode"],
    RESOLUTION_REASON_CODES,
    "reasonCode",
    {
      style: "must-be",
    },
  );
  const note = assertNonEmptyString(params["note"], "note");
  return { outcome, reasonCode, note };
}

export const resolveBackstageLineToolDefinition: DomainToolDefinition = {
  name: "resolve_backstage_line",
  description:
    "确认本轮后台确实没有值得记录的新进展，把待办提醒清掉。\n\n系统会在特定时机提醒你推进后台世界线（Beat 收口后、长时间跳过后等）。如果你审查后确认这个时间窗口里确实没有值得记录的新事件，用这个工具告诉系统「知道了，确实没发生什么」，把提醒清掉。\n\n【什么时候用】\n- 审查了后台线，确认最近这个时间窗口内确实没有任何有意义的新进展（no-change）\n- 或者当前剧情设定 / Beat 边界天然阻止了后台线在这个窗口内推进（blocked）\n\n注意：如果后台真的有新进展，不要用这个工具糊弄——用 record_offscreen_event 落地真实事件。\n\n【不能这样做】\n- 子代理还没跑完或者失败了就用这个工具糊弄清账\n- 用它替代 record_offscreen_event 来抹掉真实的后台进展",
  parameters: Type.Object({
    outcome: Type.String({ description: "no-change / blocked" }),
    reasonCode: Type.String({
      description:
        "advanced-recently / no-line-in-window / actors-on-scene / beat-forbids-backstage / blocked-by-canon",
    }),
    note: Type.String({ description: "窄结构化理由说明，一句话" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    resolveBackstageLineTool(params, ctx.sessionManager),
};
