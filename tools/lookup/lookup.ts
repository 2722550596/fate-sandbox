import type { FateToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { assertNonEmptyString, isRecord } from "../../engine/core/typebox-validation.ts";
import { lookupWorldData } from "../../engine/world-data/lookup.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

export function lookupTool(params: unknown): ToolResult {
  const query = assertNonEmptyString(isRecord(params) ? params["query"] : undefined, "query");
  const result = lookupWorldData({ query });
  return textResult(result.text);
}

export const lookupToolDefinition: FateToolDefinition = {
  name: "lookup",
  description:
    "查询诡秘之主世界权威设定：角色、地点、组织、物品、途径、设定；默认跨全库搜索，支持少量空格/逗号分隔关键词。\n\n" +
    "使用边界：预设角色/NPC、预设地点、世界观概念、身份/外观/知识边界/时点问题，先查本地再叙述。\n" +
    "禁区：凭记忆编造 canon、即兴发明诡秘设定，或用粗略摘要填补复杂外观/身份/知识边界细节。",
  parameters: Type.Object({
    query: Type.String({
      description: "搜索关键词——角色名、地点名、概念名等；多关键词用空格分隔，不要写整句",
    }),
  }),
  execute: async (_toolCallId, params) => lookupTool(params),
};
