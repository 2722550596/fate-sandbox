import type { DomainToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { textResult } from "../runtime/tool-result.ts";
import { parseAbilityQuery, lookupAbility } from "./ability-lookup.ts";

export const lookupAbilityToolDefinition: DomainToolDefinition = {
  name: "lookup_ability",
  description:
    "查询指定途径的非凡能力列表。支持按途径+序列等级查询，或按能力名称搜索。\n\n" +
    "使用边界：玩家晋升后查询新获得序列的能力、查询 NPC 非凡者可能使用的能力。\n" +
    "禁区：代替 lookup（世界设定查询）或 lookup_novel（原著章节查询）。",
  parameters: Type.Object({
    query: Type.String({
      description:
        "查询字符串，格式如「占卜家途径-序列9」或「占卜家途径-序列9-序列8」（累积）或能力名称",
    }),
    only: Type.Optional(Type.Boolean({ description: "true 时只查指定等级，不累积显示低序列能力" })),
  }),
  execute: async (_toolCallId, params) => {
    // oxlint-disable-next-line no-unsafe-type-assertion
    const raw =
      typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {};
    const query = typeof raw["query"] === "string" ? raw["query"] : "";
    const only = raw["only"] === true;
    const parsed = parseAbilityQuery(query, only);
    if (!parsed) {
      return textResult(`无法解析查询「${query}」。格式示例：「占卜家途径-序列9」`);
    }
    const result = lookupAbility(parsed);
    return textResult(result.text);
  },
};
