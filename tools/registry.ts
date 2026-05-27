/**
 * 工具注册中心
 *
 * 常驻工具（always）：
 *   get_status   — 查看当前状态
 *   patch_state  — 修改状态
 *   lookup       — 查询角色/地点/设定
 *   switch_toolset — 切换工具组
 *
 * debug 工具组：
 *   get_state_schema — 查看当前 schema
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { Type } from "typebox";

import {
  patchState,
  getState,
  writeStateToDetails,
  CURRENT_STATE_SCHEMA_VERSION,
  cloneState,
  type PatchOp,
} from "../engine/core/state";
import { lookupWorldData } from "../engine/world-data/lookup";

// --- Types ---

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
};
// --- Tool implementations ---

function toolGetStatus(): ToolResult {
  const state = cloneState();
  const text = [
    `💰 持有金钱: ${state.金钱.toLocaleString()} 円`,
    `📍 当前位置: ${state.当前位置}`,
    `💪 身体状态: ${state.身体状态}%`,
  ].join("\n");
  return { content: [{ type: "text", text }], details: {} };
}

function toolPatchState(params: { ops: ReadonlyArray<PatchOp> }): ToolResult {
  const before = cloneState();
  patchState(params.ops);
  const after = getState();

  const opsDesc = params.ops.map((op) => `${op.op} ${op.path}`).join(", ");

  const text = [
    `状态已更新 (${opsDesc})`,
    `💰 金钱: ${before.金钱.toLocaleString()} → ${after.金钱.toLocaleString()} 円`,
    `📍 位置: ${before.当前位置} → ${after.当前位置}`,
    `💪 身体: ${before.身体状态}% → ${after.身体状态}%`,
  ].join("\n");

  const details: Record<string, unknown> = {};
  writeStateToDetails(details);

  return { content: [{ type: "text", text }], details };
}

function toolLookup(params: { 查询: string; 类型?: string }): ToolResult {
  const result = lookupWorldData(params);
  return { content: [{ type: "text", text: result.text }], details: {} };
}

// --- Debug tools ---

const TOOLSET = { current: "always" };

function toolGetStateSchema(): ToolResult {
  const schema = {
    版本: CURRENT_STATE_SCHEMA_VERSION,
    字段: {
      金钱: "number — 日元余额",
      当前位置: "string — 如 冬木市·深山镇·卫宫邸",
      身体状态: "number — 0-100, 100=健康, 0=死亡",
    },
    受保护路径: ["/金钱", "/当前位置", "/身体状态"],
    仅允许: "patch_state 只能修改以上三个路径",
  };
  return { content: [{ type: "text", text: JSON.stringify(schema, null, 2) }], details: {} };
}

function toolSwitchToolset(params: { toolset: string }): ToolResult {
  const allowed = ["always", "debug"];
  if (!allowed.includes(params.toolset)) {
    return {
      content: [
        { type: "text", text: `无效工具组: ${params.toolset}。可选: ${allowed.join(", ")}` },
      ],
      details: {},
    };
  }
  TOOLSET.current = params.toolset;
  return {
    content: [{ type: "text", text: `工具组已切换至: ${params.toolset}` }],
    details: {},
  };
}

// --- Registration ---

export function registerAllTools(pi: ExtensionAPI): void {
  const label = "FSN 沙盒";

  pi.registerTool({
    label,
    name: "get_status",
    description:
      "查看玩家角色的当前状态（金钱、位置、身体状态）。\n\n" +
      "【必须调用的场景】\n" +
      "- 需要确认玩家当前持有金钱、所在位置或身体状况时\n" +
      "- 玩家询问「我现在有多少钱」「我在哪」「我身体怎么样」时\n\n" +
      "【严禁的行为】\n" +
      "- 凭记忆叙述金钱数额——你的内部记忆不可靠\n" +
      "- 编造位置信息——以工具返回的当前位置为准",
    parameters: Type.Object({}),
    execute: async () => toolGetStatus(),
  });

  pi.registerTool({
    label,
    name: "patch_state",
    description:
      "修改玩家状态（金钱、位置、身体状态）。只能修改这三个字段。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家获得/消费金钱时\n" +
      "- 玩家移动到新地点时\n" +
      "- 玩家受伤/治愈时\n\n" +
      "【严禁的行为】\n" +
      "- 修改金钱/位置/身体状态以外的任意字段（会被拒绝）\n" +
      "- 叙事中提到状态变化但不调用此工具——必须先 tool call 再叙事\n\n" +
      "参数 ops 为 JSON Patch 数组，每个 op 包含:\n" +
      '- op: "replace"（通常用这个）\n' +
      '- path: "/金钱" | "/当前位置" | "/身体状态"\n' +
      "- value: 新值",
    parameters: Type.Object({
      ops: Type.Array(
        Type.Object({
          op: Type.Union([Type.Literal("replace")], {
            description: "操作类型——一般用 replace",
          }),
          path: Type.String({ description: "路径，如 /金钱、/当前位置、/身体状态" }),
          value: Type.Unknown({ description: "新值" }),
        }),
        { description: "JSON Patch 操作数组" },
      ),
    }),
    execute: async (_toolCallId, params) => toolPatchState(params),
  });

  pi.registerTool({
    label,
    name: "lookup",
    description:
      "查询型月世界的权威设定——角色、从者、地点、概念、时间线的唯一数据入口。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家遇到或提及任何预设角色/从者/NPC——必须先查再叙述\n" +
      "- 玩家进入预设地点——先查地点设定再描述环境\n" +
      "- 需要引用型月世界观概念（圣杯、魔术、英灵等）——这是唯一权威来源\n" +
      "- 玩家询问某个时间线事件\n\n" +
      "【严禁的行为】\n" +
      "- 凭记忆编造角色外貌/性格/背景——你的内部记忆不是权威来源\n" +
      "- 编造地点名称和环境细节\n" +
      "- 即兴「发明」型月设定——哪怕你觉得自己记得，也先查一下\n\n" +
      "参数: 查询（必填，角色名/地点名/概念名/时间线名）、类型（可选，角色/从者/地点/设定/时间线）",
    parameters: Type.Object({
      查询: Type.String({ description: "搜索关键词——角色名、地点名、概念名等" }),
      类型: Type.Optional(Type.String({ description: "可选过滤: 角色、从者、地点、设定、时间线" })),
    }),
    execute: async (_toolCallId, params) => toolLookup(params),
  });

  pi.registerTool({
    label,
    name: "switch_toolset",
    description:
      "切换可用工具组。一般不需要使用——默认 always 工具组包含所有常用工具。\n" +
      "debug 工具组包含调试/维护工具（get_state_schema 等），仅开发调试时使用。",
    parameters: Type.Object({
      toolset: Type.String({ description: "工具组名: always 或 debug" }),
    }),
    execute: async (_toolCallId, params) => toolSwitchToolset(params),
  });

  pi.registerTool({
    label,
    name: "get_state_schema",
    description: "【调试工具】查看当前状态 schema 版本与字段定义。",
    parameters: Type.Object({}),
    execute: async () => toolGetStateSchema(),
  });
}
