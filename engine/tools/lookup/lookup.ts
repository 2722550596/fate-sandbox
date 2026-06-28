import type { DomainToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { assertNonEmptyString, isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";
import { lookupWorldData } from "./world-data.ts";

export function lookupTool(params: unknown): ToolResult {
  const query = assertNonEmptyString(isRecord(params) ? params["query"] : undefined, "query");
  const rawCategory = isRecord(params) ? params["category"] : undefined;
  const category = typeof rawCategory === "string" ? rawCategory : undefined;
  const result = lookupWorldData({ query, category });
  return textResult(result.text);
}

export const lookupToolDefinition: DomainToolDefinition = {
  name: "lookup",
  description:
    "查询诡秘之主世界权威设定：角色、地点、组织、物品、途径、设定等。\n\n" +
    "查询方式：关键词查询，多关键词用空格分隔（不支持自动中文分词，请手动拆分）。会优先匹配关键词，再模糊匹配原文。\n\n" +
    "category 为可选项：传对了会优先该分类，传错或不传则跨全库搜索。支持中文（角色/地点/组织/途径/物品/设定/经济/机制）或英文别名（character/location/organization/pathway/item/lore/economy/mechanic）。\n\n" +
    "使用边界：预设角色/NPC、预设地点、世界观概念、身份/外观/知识边界/时点问题，先查本地再叙述。\n" +
    "禁区：凭记忆编造 canon、即兴发明诡秘设定，或用粗略摘要填补复杂外观/身份/知识边界细节。",
  parameters: Type.Object({
    query: Type.String({
      description:
        "搜索关键词——角色名、地点名、概念名等；多关键词用空格分隔。不支持自动中文分词，请手动拆词。",
    }),
    category: Type.Optional(
      Type.String({
        description:
          "可选分类过滤。中文：角色/地点/组织/途径/物品/设定/经济/机制；英文：character/location/organization/pathway/item/lore/economy/mechanic。传错不影响搜索，只是不优先。",
      }),
    ),
  }),
  execute: async (_toolCallId, params) => lookupTool(params),
};
