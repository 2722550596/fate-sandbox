/**
 * Fate/Stay Night 沙盒 — pi extension
 *
 * DeepSeek V4 特化：系统提示极简 + 上下文/铁则注入 user 消息流 + 全链路中文
 */

import type { ContextEvent, ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { syncStateFromSessionManager } from "./engine/core/session-hydration.ts";
import { buildSystemPrompt, injectGmPromptMessages } from "./engine/gm-prompt/injection.ts";
import { registerAllTools } from "./tools/registry.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function extension(pi: ExtensionAPI): void {
  pi.on("resources_discover", async () => {
    return { skillPaths: [join(__dirname, "skills")] };
  });

  pi.on("before_agent_start", async (event) => {
    return { systemPrompt: buildSystemPrompt(event.systemPrompt) };
  });

  pi.on("context", async (event, ctx) => {
    syncStateFromSessionManager(ctx.sessionManager);
    return { messages: injectGmPromptMessages<ContextEvent["messages"][number]>(event.messages) };
  });

  pi.on("session_start", async (_event, ctx) => {
    syncStateFromSessionManager(ctx.sessionManager);
  });

  pi.on("session_tree", async (_event, ctx) => {
    syncStateFromSessionManager(ctx.sessionManager);
  });

  pi.on("tool_call", async (_event, ctx) => {
    syncStateFromSessionManager(ctx.sessionManager);
  });

  registerAllTools(pi);
}
