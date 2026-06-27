import type { TurnCommitEvent } from "../../core/turn/turn-commit.ts";
import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import {
  assertNoOpenBackstageObligation,
  recordCanonicalTurnForBackstage,
} from "../../core/backstage/backstage-obligation.ts";
import { formatPendingHarvestReminder } from "../../core/backstage/backstage-pending.ts";
import { commitTurn } from "../../core/turn/turn-commit.ts";
import { resultDetails, runDomainEventTool } from "../system/domain-tool-runner.ts";
import { normalizeTurnCommitInput } from "./commit-turn-normalizer.ts";
import { timePolicySchema } from "./time-policy-tool-schema.ts";

// 本轮是否产生机械代价：用于打断后台 no-cost 连击。可检测核心集。
const COST_EVENT_KINDS = new Set(["actor-condition", "economy", "sequence", "memory"]);
function turnHasCost(events: readonly TurnCommitEvent[]): boolean {
  return events.some((event) => {
    if (COST_EVENT_KINDS.has(event.kind)) {
      return true;
    }
    return event.kind === "scene" && event.event.kind === "add-threat";
  });
}

export function commitTurnTool(params: unknown, sessionManager: unknown): ToolResult {
  const input = normalizeTurnCommitInput(params);
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      // 延迟硬阻断：上一轮触发的后台推进义务未清账则拒绝本次 canonical turn。
      assertNoOpenBackstageObligation(draft);
      const result = commitTurn(draft, input);
      recordCanonicalTurnForBackstage(draft, {
        elapsedMinutes: input.time.elapsedMinutes,
        hasCost: turnHasCost(input.events),
        beatBoundary: false,
      });
      return { result, pendingReminder: formatPendingHarvestReminder(draft) };
    },
    details: ({ result }) => resultDetails(result),
    message: ({ result, pendingReminder }) =>
      pendingReminder === null ? result.message : `${result.message}\n\n${pendingReminder}`,
  });
}

export const commitTurnToolDefinition: FateToolDefinition = {
  name: "commit_turn",
  description:
    "每轮叙事结束时一次性提交本轮领域事件。用于一轮内聚合多个状态变化。\n\n" +
    "【使用边界】\n" +
    "- 每次 canonical turn 都必须提交顶层 time\n" +
    "- 一轮内同时改变时间、地点、目标、伤势、物品、资金、记忆或序列变更\n" +
    "- Scene Beat 开启/收口优先用 progress_scene_beat\n" +
    "- resolve_combat 登记的义务必须在本次 events 里落地\n\n" +
    "禁区：\n" +
    "- 把它当裸 patch\n" +
    "- 在 events 里写时间或移动\n" +
    "- 提交隐藏事实到 public\n" +
    "- 同一回复连续提交多个前台 canonical turn",
  parameters: Type.Object({
    summary: Type.Optional(
      Type.String({
        description: "本轮玩家可见状态变化摘要；省略时自动生成",
      }),
    ),
    time: timePolicySchema(),
    events: Type.Array(
      Type.Object({
        kind: Type.String({
          description: "scene / scene-presence / actor-condition / sequence / economy / memory",
        }),
        event: Type.Unknown({
          description:
            "对应领域事件载荷；scene event 不包含时间/移动；resolve-objective 只用于当前目标",
        }),
      }),
    ),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    commitTurnTool(params, ctx.sessionManager),
};
