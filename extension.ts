/**
 * 型月（Type-Moon / Fate）世界观沙盒 — pi extension
 *
 * DeepSeek V4 特化：系统提示极简 + 上下文/铁则注入 user 消息流 + 全链路中文
 */

import type { ContextEvent, ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { syncStateFromSessionManager } from "./engine/core/state/session-persistence.ts";
import { exportState } from "./engine/core/state/state-store.ts";
import { isRecord } from "./engine/core/utils/typebox-validation.ts";
import { PROSE_CUSTOM_TYPE } from "./engine/direction/render-turn.ts";
import { stripLeakedSettlementProse } from "./engine/direction/settlement-prose-firewall.ts";
import { buildSystemPrompt, injectGmPromptMessages } from "./engine/gm-prompt/injection.ts";
import { registerAllTools } from "./engine/tools/registry.ts";
import {
  buildTimelineStateContextBlock,
  injectTimelineContextIntoSubagentInput,
} from "./extensions/subagents/timeline/task-injection.ts";

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
    // 结算器（Pass A）投影：渲染产物不作为对话流消息进结算上下文，但最后一轮渲染正文
    // 作为物理连续性锚注入 pre-response slot，防止跨轮物理状态断裂。
    let lastRenderedProse: string | undefined;
    const settlementMessages = event.messages
      .filter((message) => {
        if (isRecord(message) && message["customType"] === PROSE_CUSTOM_TYPE) {
          const text = extractProseText(message);
          if (text.length > 0) {
            lastRenderedProse = text;
          }
          return false;
        }
        return true;
      })
      // 历史里已落盘的结算器漏稿（message_end 上线前的回合）在此就地中和：只整形
      // 喂给结算模型的 per-call 视图，不改存档。新存档由 message_end 源头收口，
      // 老存档靠这层兜底，二者互补。
      .map((message) => stripLeakedSettlementProse(message) ?? message);
    return {
      messages: injectGmPromptMessages<ContextEvent["messages"][number]>(
        settlementMessages,
        lastRenderedProse,
      ),
    };
  });

  pi.on("session_start", async (_event, ctx) => {
    syncStateFromSessionManager(ctx.sessionManager);
  });

  pi.on("session_tree", async (_event, ctx) => {
    syncStateFromSessionManager(ctx.sessionManager);
  });

  pi.on("tool_call", async (event, ctx) => {
    syncStateFromSessionManager(ctx.sessionManager);
    if (event.toolName === "subagent") {
      // timeline 子代理是独立 pi 进程，看不到主进程的 canonical state；
      // 这里在调用发出前把子代理安全投影改写进 task（event.input 官方可变），
      // 取代旧的 state/state.json 侧通道。注入失败不阻断调用，
      // 子代面按缺上下文的契约降级处理。
      try {
        injectTimelineContextIntoSubagentInput(
          event.input,
          buildTimelineStateContextBlock(exportState()),
        );
      } catch {
        // 不让注入异常打断 subagent 调用本身。
      }
    }
  });

  registerAllTools(pi);
}

/** 从 fsn-prose custom message 中提取纯文本。 */
function extractProseText(message: Record<string, unknown>): string {
  const content = message["content"];
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        isRecord(part) && part["type"] === "text" && typeof part["text"] === "string",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
}
