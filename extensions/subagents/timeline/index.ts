import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";

import { buildTimelineStateContextFromRaw } from "../../../engine/core/state-file-projection.ts";
export { buildTimelineStateContextFromRaw as buildTimelineStateContext } from "../../../engine/core/state-file-projection.ts";
import { lookupTool } from "../../../tools/lookup/lookup.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const STATE_PATH = join(PROJECT_ROOT, "state", "state.json");

export default function timelineSubagentsExtension(pi: ExtensionAPI): void {
  pi.on("before_agent_start", async (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${buildTimelineStateInjection()}`,
  }));

  pi.registerTool({
    name: "lookup",
    label: "lookup",
    description:
      "查询型月世界的权威设定。仅用于 subagent 核对当前世界线相关公开设定；不要用它读取或修改 canonical state。",
    parameters: Type.Object({
      query: Type.String({
        description: "搜索关键词——角色名、地点名、概念名等；多关键词用空格分隔，不要写整句。",
      }),
    }),
    execute: async (_toolCallId, params) => lookupTool(params),
  });
}

function buildTimelineStateInjection(): string {
  try {
    const raw: unknown = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
    const context = buildTimelineStateContextFromRaw(raw);
    return [
      "<timeline_state_context>",
      "以下是当前 canonical state 的子代理安全摘要，由 extension 自动注入；不要要求主 GM 重复提供，也不要把本段原样写给玩家。",
      "parallel-line 必须先检查 recentOffscreenEvents，避免连续重复同一 actor/faction/pressureType；如果最近已连续使用同一压力类型，优先换成当前 timeline 的其它生态位或返回 no-change/blocked。",
      "所有输出 timeRange.start/end 必须是 ISO UTC 字符串；displayTime 只是本地展示时间，不得把本地时钟当 UTC。timeRange.end 不得晚于 currentAt。",
      JSON.stringify(context, null, 2),
      "</timeline_state_context>",
    ].join("\n");
  } catch (error) {
    return [
      "<timeline_state_context>",
      `当前 state/state.json 读取失败：${formatError(error)}。不要假装知道幕后事件；如输入也没有提供 recentOffscreenEvents，重复路线风险应标为 riskFlags。`,
      "</timeline_state_context>",
    ].join("\n");
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
