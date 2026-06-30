import type { HookState, State } from "../../core/state/state.ts";
import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  escalateHook,
  openHook,
  parkHook,
  payHook,
  retireHook,
  surfaceHook,
} from "../../core/ledger/hooks.ts";
import {
  assertNonEmptyString,
  isRecord,
  parseTypeBoxValue,
} from "../../core/utils/typebox-validation.ts";
import { runDomainEventTool } from "./domain-tool-runner.ts";

const UPDATE_HOOK_KINDS = ["open", "surface", "park", "escalate", "pay", "retire"] as const;

export function updateHookTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => executeUpdateHook(draft, params),
    details: (message) => ({ message }),
    message: (message) => message,
  });
}

function executeUpdateHook(draft: State, params: unknown): string {
  if (!isRecord(params)) {
    throw new Error("update_hook 参数必须是对象。");
  }
  const kind = assertNonEmptyString(params["kind"], "kind");
  switch (kind) {
    case "open": {
      const input = parseTypeBoxValue(params, "open 参数", OPEN_VALIDATOR);
      const hook = openHook(draft, input.label);
      return `悬念已登记并激活：${formatHookLine(hook)}`;
    }
    case "surface": {
      const input = parseTypeBoxValue(params, "surface 参数", SURFACE_VALIDATOR);
      const hook = surfaceHook(draft, input.hookId, input.novelty);
      return `悬念已复现（必须在正文里体现新状态）：${formatHookLine(hook)}`;
    }
    case "park": {
      const input = parseTypeBoxValue(params, "park 参数", PARK_VALIDATOR);
      const hook = parkHook(draft, input.hookId, input.reason);
      return `悬念已搁置为背景压力：${formatHookLine(hook)}。1-2 轮内不要再抢焦点；复现必须带新状态。`;
    }
    case "escalate": {
      const input = parseTypeBoxValue(params, "escalate 参数", ESCALATE_VALIDATOR);
      const hook = escalateHook(draft, input.hookId, input.novelty);
      return `悬念已升级：${formatHookLine(hook)}。升级后的压力必须在正文与状态里可见。`;
    }
    case "pay": {
      const input = parseTypeBoxValue(params, "pay 参数", PAY_VALIDATOR);
      const hook = payHook(draft, input.hookId, input.payoff);
      return `悬念已兑现（终态）：${formatHookLine(hook)}`;
    }
    case "retire": {
      const input = parseTypeBoxValue(params, "retire 参数", RETIRE_VALIDATOR);
      const hook = retireHook(draft, input.hookId, input.reason);
      return `悬念已退场（终态）：${formatHookLine(hook)}`;
    }
    default:
      throw new Error(`不支持的 kind: ${kind}。允许: ${UPDATE_HOOK_KINDS.join(" / ")}。`);
  }
}

function formatHookLine(hook: HookState): string {
  return `${hook.id}｜${hook.label}（${hook.status}，出现 ${hook.surfaceCount} 次）`;
}

const OPEN_SCHEMA = Type.Object({
  kind: Type.Literal("open"),
  label: Type.String({ minLength: 1 }),
});
const SURFACE_SCHEMA = Type.Object({
  kind: Type.Literal("surface"),
  hookId: Type.String({ minLength: 1 }),
  novelty: Type.String({ minLength: 1 }),
});
const PARK_SCHEMA = Type.Object({
  kind: Type.Literal("park"),
  hookId: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});
const ESCALATE_SCHEMA = Type.Object({
  kind: Type.Literal("escalate"),
  hookId: Type.String({ minLength: 1 }),
  novelty: Type.String({ minLength: 1 }),
});
const PAY_SCHEMA = Type.Object({
  kind: Type.Literal("pay"),
  hookId: Type.String({ minLength: 1 }),
  payoff: Type.String({ minLength: 1 }),
});
const RETIRE_SCHEMA = Type.Object({
  kind: Type.Literal("retire"),
  hookId: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

const OPEN_VALIDATOR = Compile(OPEN_SCHEMA);
const SURFACE_VALIDATOR = Compile(SURFACE_SCHEMA);
const PARK_VALIDATOR = Compile(PARK_SCHEMA);
const ESCALATE_VALIDATOR = Compile(ESCALATE_SCHEMA);
const PAY_VALIDATOR = Compile(PAY_SCHEMA);
const RETIRE_VALIDATOR = Compile(RETIRE_SCHEMA);

export const updateHookToolDefinition: DomainToolDefinition = {
  name: "update_hook",
  description:
    "管理悬念（mystery hook）的完整生命周期——从登记、复现、升级到兑现或退场。\n\n悬念是埋在叙事里的压力源：一个未解之谜、一个潜伏的威胁、一条暗线。每个悬念从登记（open）开始，可以多次复现（surface）、升级（escalate）、临时搁置（park），最终兑现（pay）或退场（retire）。\n\n【操作流程】\n- open：在正文中**第一次引入悬念之前**先登记。先 open 拿到 hookId，再在正文中写出悬念的出现。\n- surface：已登记的悬念再次出现在正文中，novelty 必填——复现必须给玩家新的信息或状态变化，不能原样重复。\n- park：玩家明确无视、绕开或暂时无法处理的悬念。搁置后 1-2 轮内不要抢焦点，复现必须带新状态。\n- escalate：悬念的压力实质上调——威胁升级、谜团加深、倒计时逼近。novelty 必填。\n- pay：悬念兑现——谜底揭晓、威胁爆发、线索落地。终态。\n- retire：悬念不再有价值——线索断了、威胁解除了、玩家彻底离开了这条线。终态，需要理由留痕。\n\n【与 Scene Beat 的关系】\n悬念不绑定到特定的 Scene Beat——一个悬念可以贯穿多个 Beat，跨 Beat 复现或升级是完全正常的。\n\n【并发预算】\n同时处于施加压力状态的悬念（active + escalated）最多 2 条。parked（搁置）、paid（已兑现）、retired（已退场）的悬念不计入预算，可以有很多条。\n预算满时强行 open 新悬念会被拒绝——先 park / pay / retire 一条再开新的。\n\n【不要这样做】\n- 不登记就让悬念反复出现在正文中（引擎无法追踪压力预算）\n- 用空泛的 novelty 来维持悬念的存在感（每次复现/升级必须有新内容）\n- 预算满时强行开新悬念",
  parameters: Type.Object({
    kind: Type.String({ description: "open / surface / park / escalate / pay / retire" }),
    label: Type.Optional(Type.String({ description: "open 必填：悬念的内容描述，一句话" })),
    hookId: Type.Optional(
      Type.String({ description: "除 open 外必填：目标悬念的 hookId；open 返回的 id 要保存好" }),
    ),
    novelty: Type.Optional(
      Type.String({
        description: "surface/escalate 必填：本轮出现的新信息或状态变化，不能原样重复",
      }),
    ),
    payoff: Type.Optional(Type.String({ description: "pay 必填：悬念兑现的结果，发生了什么" })),
    reason: Type.Optional(Type.String({ description: "park/retire 必填：为什么搁置或退场" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    updateHookTool(params, ctx.sessionManager),
};
