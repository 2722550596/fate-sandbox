import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";

import { textResult } from "../runtime/tool-result.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEBUG_DIR = join(__dirname, "..", "..", "..", ".debug");

function ensureDebugDir(): void {
  mkdirSync(DEBUG_DIR, { recursive: true });
}

export function debugSignalTool(params: unknown): ToolResult {
  // oxlint-disable-next-line no-unsafe-type-assertion
  const raw =
    typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {};

  const signal = {
    timestamp: new Date().toISOString(),
    kind: typeof raw["kind"] === "string" ? raw["kind"] : "debug",
    data: raw["data"] ?? {},
  };

  ensureDebugDir();
  const logFile = join(DEBUG_DIR, `debug-${new Date().toISOString().slice(0, 10)}.jsonl`);
  writeFileSync(logFile, JSON.stringify(signal) + "\n", { flag: "a" });

  return textResult(`debug 信号已记录: ${JSON.stringify(signal)}`);
}

export const debugSignalToolDefinition: DomainToolDefinition = {
  name: "debug_signal",
  description:
    "记录调试信号到 .debug/ 目录的 JSONL 文件。用于 GM 调试、状态快照、prompt 追踪。\n\n" +
    "使用边界：需要记录调试信息时使用。\n" +
    "禁区：在正常游戏流程中滥用。",
  parameters: Type.Object({
    kind: Type.String({
      description: "信号类型标签，如 state-snapshot / prompt-hook / error-trace",
    }),
    data: Type.Optional(
      Type.Record(Type.String(), Type.Unknown(), {
        description: "调试数据（任意 JSON）",
      }),
    ),
  }),
  execute: async (_toolCallId, params) => debugSignalTool(params),
};
