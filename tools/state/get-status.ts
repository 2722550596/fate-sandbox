import { buildGmBrief } from "../../engine/core/gm-brief";
import { hydrateStateFromSessionManager } from "../../engine/core/session-hydration";
import { getState } from "../../engine/core/state-store";
import { textResult, type ToolResult } from "../runtime/tool-result";

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
