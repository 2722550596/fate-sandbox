import type { FsnToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { assertNonEmptyString, isRecord } from "../../engine/core/typebox-validation.ts";
import { lookupWorldData } from "../../engine/world-data/lookup.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

export function lookupTool(params: unknown): ToolResult {
  const query = assertNonEmptyString(isRecord(params) ? params["query"] : undefined, "query");
  const result = lookupWorldData({ query });
  return textResult(result.text);
}

export const lookupToolDefinition: FsnToolDefinition = {
  name: "lookup",
  description:
    "查询型月世界的权威设定——角色、从者、地点、概念、时间线的唯一数据入口。默认跨全库搜索；支持单关键词，也支持用空格/逗号分隔的少量关键词（如“绫香 沙条 Fate strange Fake”“两仪式 空之境界”）。\n\n" +
    "【必须调用的场景】\n" +
    "- 玩家遇到或提及任何预设角色/从者/NPC——必须先查再叙述\n" +
    "- 玩家进入预设地点——先查地点设定再描述环境\n" +
    "- 需要引用型月世界观概念（圣杯、魔术、英灵等）\n\n" +
    "【严禁的行为】\n" +
    "- 凭记忆编造角色外貌/性格/背景\n" +
    "- 即兴发明型月设定",
  parameters: Type.Object({
    query: Type.String({
      description: "搜索关键词——角色名、地点名、概念名等；多关键词用空格分隔，不要写整句",
    }),
  }),
  execute: async (_toolCallId, params) => lookupTool(params),
};
