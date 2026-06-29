import type { TurnCommitEvent } from "../../core/turn/turn-commit.ts";
import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
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

export const commitTurnToolDefinition: DomainToolDefinition = {
  name: "commit_turn",
  description:
    "State 层收口：每轮叙事结束时一次性提交本轮全部机械状态变化。\n\n" +
    "设计逻辑：一轮 GM 回复内只能调一次，用 events[] 数组聚合本轮所有领域事件\n" +
    "（时间/场景/伤势/物品/资金/记忆/序列），一次落地。它是 state 层面的\n" +
    "「写」入口——没有它，时钟不推进、turn log 为空、backstage 义务不触发。\n" +
    "它不是最终收尾工具——调完 commit_turn 后还需调 submit_direction_packet\n\n" +
    "【使用边界】\n" +
    "- 每轮必调一次，events 数组一次打包本轮所有状态变化\n" +
    "- 顶层 time 必填（elapsed / travel）；时间推进不走 events\n" +
    "- 同一事件内可混写多种 kind（例：scene.set-location + economy.spend-money + memory.pin-fact）\n" +
    "- Scene Beat 开启/收口走 progress_scene_beat，不走这里\n" +
    "- resolve_combat 登记的义务必须在 events 里落地\n\n" +
    "禁区：\n" +
    "- 同一回复内调多次（你只用调一次打包就行）\n" +
    "- 在 events 里写时间或移动（走顶层 time）\n" +
    "- 把它当裸 patch 用（必须表达领域事件语义）\n" +
    "- 提交隐藏事实到 public（你应该通过 reveal_secret 控制曝露）",
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
          description:
            "scene / scene-presence / actor-condition / outfit / acting / sequence / economy / memory",
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
