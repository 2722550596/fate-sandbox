import type { DomainToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { buildGmBrief } from "../../core/state/public-projection.ts";
import { hydrateStateFromSessionManager } from "../../core/state/session-persistence.ts";
import { getState } from "../../core/state/state-store.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

const lastStatusRevisionBySession = new WeakMap<object, string>();
let lastGlobalStatusRevision: string | null = null;

export function getStatusTool(sessionManager?: unknown): ToolResult {
  if (sessionManager !== undefined) {
    hydrateStateFromSessionManager(sessionManager);
  }
  const state = getState();
  const revision = statusRevision(state);
  rejectRepeatedStatusRead(sessionManager, revision);
  rememberStatusRead(sessionManager, revision);
  return textResult(buildGmBrief(state.public, state.secrets));
}

function rejectRepeatedStatusRead(sessionManager: unknown, revision: string): void {
  const previousRevision = readPreviousStatusRevision(sessionManager);
  if (previousRevision === revision) {
    throw new Error(
      "get_status 已读取当前状态；状态未变化。继续使用上一份简报，或先提交会改变状态的领域事件。",
    );
  }
}

function readPreviousStatusRevision(sessionManager: unknown): string | null {
  if (isObject(sessionManager)) {
    return lastStatusRevisionBySession.get(sessionManager) ?? null;
  }
  return lastGlobalStatusRevision;
}

function rememberStatusRead(sessionManager: unknown, revision: string): void {
  if (isObject(sessionManager)) {
    lastStatusRevisionBySession.set(sessionManager, revision);
    return;
  }
  lastGlobalStatusRevision = revision;
}

function statusRevision(state: ReturnType<typeof getState>): string {
  return JSON.stringify({ meta: state.meta, public: state.public });
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

export const getStatusToolDefinition: DomainToolDefinition = {
  name: "get_status",
  description:
    "查看玩家可见摘要；返回 GM brief 风格读模型，不展示完整 JSON。\n\n" +
    "使用边界：当前回合缺少可用 GM brief/工具结果、玩家询问状态/同行者/资源/剧情账本，或工具失败后一次性同步玩家可见状态。\n" +
    "禁区：状态未变化时重复刷新、凭记忆叙述机械事实，或要求/输出 canonical state JSON。",
  parameters: Type.Object({}),
  execute: async (_toolCallId, _params, _signal, _onUpdate, ctx) =>
    getStatusTool(ctx.sessionManager),
};

export const getStatusRawToolDefinition: DomainToolDefinition = {
  name: "get_status_raw",
  description:
    "查看完整 JSON 状态。返回 canonical state 的全貌，包括 secrets、后台事件等 GM 视角完整数据。\n\n" +
    "使用边界：需要查看 state 全貌进行 debug/诊断，或需要确认完整参数时。\n" +
    "禁区：常规叙事流程中代替 get_status。",
  parameters: Type.Object({}),
  execute: async (_toolCallId, _params, _signal, _onUpdate, ctx) => {
    if (ctx.sessionManager !== undefined) {
      hydrateStateFromSessionManager(ctx.sessionManager);
    }
    const state = getState();
    return textResult(JSON.stringify(state, null, 2));
  },
};
