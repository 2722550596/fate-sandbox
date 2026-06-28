/**
 * Debug 扩展：捕获 passA（结算器）和 passB（渲染器）的完整提示词。
 *
 * 通过环境变量 DEBUG_PROMPT=true 启用。不启用时本扩展不加载，零开销。
 *
 * 输出格式：.debug/prompt-{N}.jsonl，每行一条 message 记录：
 *   { "ts": "ISO", "pass": "A"|"B", "idx": 0, "role": "system", "content": "..." }
 *
 * 设计参考：my-card/.pi/lib/test-preamble.ts（before_provider_request 钩子）
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const DEBUG_DIR = join(PROJECT_ROOT, ".debug");

/** 渲染器 system prompt 的特征标记，用于区分 passA / passB */
const RENDERER_MARKER = "你是叙事渲染器";

let requestCounter = 0;

function ensureDir(): void {
  mkdirSync(DEBUG_DIR, { recursive: true });
}

function classifyPass(messages: Array<{ role: string; content: unknown }>): "A" | "B" {
  for (const msg of messages) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      if (text.includes(RENDERER_MARKER)) {
        return "B";
      }
    }
  }
  return "A";
}

export default function debugPromptCapture(pi: ExtensionAPI): void {
  ensureDir();

  // ── 钩子 1: before_agent_start — 保存组装后的 system prompt ────────
  pi.on("before_agent_start", async (event) => {
    const ts = new Date().toISOString();
    const outFile = join(DEBUG_DIR, `systemprompt-${ts.replace(/[:.]/gu, "-")}.md`);
    writeFileSync(outFile, event.systemPrompt ?? "", "utf-8");
    console.log(`[debug-prompt-capture] system prompt saved: ${outFile}`);
    return {};
  });

  // ── 钩子 2: before_provider_request — 捕获发给 LLM 的完整 messages ──
  // 这是关键：拿到最终 payload，区分 passA/passB，写入 JSONL
  pi.on("before_provider_request", (event) => {
    requestCounter++;
    // oxlint-disable-next-line no-unsafe-type-assertion — pi event payload is dynamic by design
    const payload = event.payload as Record<string, unknown> | undefined;
    if (payload?.["messages"] === undefined) return;

    // oxlint-disable-next-line no-unsafe-type-assertion — validated by check above
    const messages = payload["messages"] as Array<{ role: string; content: unknown }>;
    const pass = classifyPass(messages);
    const ts = new Date().toISOString();

    const logFile = join(
      DEBUG_DIR,
      `prompt-${String(requestCounter).padStart(3, "0")}-${pass}.jsonl`,
    );

    const entries = messages.map((m, i) => ({
      ts,
      pass,
      idx: i,
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content, null, 2),
    }));

    const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    writeFileSync(logFile, lines, "utf-8");

    console.log(
      `[debug-prompt-capture] request #${requestCounter} (${pass}) saved: ${logFile} (${messages.length} messages)`,
    );
  });
}
