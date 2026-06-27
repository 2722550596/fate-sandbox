import type { HookState, State } from "../../core/state/state.ts";
import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  MAX_ACTIVE_HOOKS,
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

export const updateHookToolDefinition: FateToolDefinition = {
  name: "update_hook",
  description:
    `Mystery hook 账本：悬念的登记与生命周期（active/parked/paid/escalated/retired）。active+escalated 同时最多 ${MAX_ACTIVE_HOOKS} 条。\n\n` +
    "【使用边界】\n" +
    "- 正文第一次引入悬念：open\n" +
    "- 已登记悬念再次出现：surface，novelty 必填\n" +
    "- 玩家明确无视/绕开悬念：park\n" +
    "- 悬念压力实质上调：escalate，novelty 必填\n" +
    "- 悬念兑现：pay\n" +
    "- 悬念不再有价值：retire\n\n" +
    "禁区：\n" +
    "- 不登记就反复让悬念出现在正文\n" +
    "- 用空泛 novelty 维持存在感\n" +
    "- 预算满时硬开新悬念",
  parameters: Type.Object({
    kind: Type.String({ description: "open / surface / park / escalate / pay / retire" }),
    label: Type.Optional(Type.String({ description: "open 必填：悬念内容" })),
    hookId: Type.Optional(Type.String({ description: "除 open 外必填" })),
    novelty: Type.Optional(Type.String({ description: "surface/escalate 必填：新状态" })),
    payoff: Type.Optional(Type.String({ description: "pay 必填：兑现内容" })),
    reason: Type.Optional(Type.String({ description: "park/retire 必填" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    updateHookTool(params, ctx.sessionManager),
};
