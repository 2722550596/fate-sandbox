import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import { buildGmBrief } from "../../engine/core/public-projection.ts";
import { hydrateStateFromSessionManager } from "../../engine/core/session-hydration.ts";
import { getState } from "../../engine/core/state-store.ts";
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
  return textResult(buildGmBrief(state.public));
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

export const getStatusToolDefinition: FsnToolDefinition = {
  name: "get_status",
  description:
    "查看玩家可见状态摘要；返回 GM brief 风格读模型，不展示完整 JSON。\n\n" +
    "【必须调用的场景】\n" +
    "- 当前回合没有可用 GM brief 或工具结果，必须先取得玩家可见状态\n" +
    "- 玩家明确询问当前状态、同行者、资源或剧情账本\n" +
    "- 工具失败后需要一次性重新同步玩家可见状态\n\n" +
    "【严禁的行为】\n" +
    "- 状态未变化时重复调用\n" +
    "- 已有当前 GM brief 或本轮工具结果时，把它当刷新按钮\n" +
    "- 凭记忆叙述机械事实——以工具返回为准\n" +
    "- 要求或输出 canonical state JSON",
  parameters: Type.Object({}),
  execute: async (_toolCallId, _params, _signal, _onUpdate, ctx) =>
    getStatusTool(ctx.sessionManager),
};
