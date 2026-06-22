import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";
import type { BackstageResolutionInput } from "../../engine/core/backstage-obligation.ts";

import { Type } from "typebox";

import { settleOldestBackstageObligation } from "../../engine/core/backstage-obligation.ts";
import { assertNoUnharvestedPending } from "../../engine/core/backstage-pending.ts";
import { assertOneOfString } from "../../engine/core/string-enum.ts";
import { assertNonEmptyString, isRecord } from "../../engine/core/typebox-validation.ts";

import { runDomainEventTool } from "./domain-tool-runner.ts";

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
  const reasonCode = assertOneOfString(params["reasonCode"], RESOLUTION_REASON_CODES, "reasonCode", {
    style: "must-be",
  });
  const note = assertNonEmptyString(params["note"], "note");
  return { outcome, reasonCode, note };
}

export const resolveBackstageLineToolDefinition: FateToolDefinition = {
  name: "resolve_backstage_line",
  description:
    "清掉一条未清账的后台世界推进义务——仅用于经审查确认本轮后台无可落地推进的情形。\n\n" +
    "【使用边界】\n" +
    "- run_parallel_line / parallel-line 子代理审查后判定 no-change（确无新进展）或 blocked（被设定/beat 阻断）\n" +
    "- 有真实后台进展时不要用本工具，用 record_offscreen_event 落地\n\n" +
    "禁区：\n" +
    "- 子代理失败/未调用就用本工具糊弄清账\n" +
    "- 用它替代 record_offscreen_event 落地真实事件",
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
