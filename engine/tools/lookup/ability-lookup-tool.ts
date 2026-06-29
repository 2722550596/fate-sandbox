import type { DomainToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult } from "../runtime/tool-result.ts";
import { parseAbilityQuery, lookupAbility, searchAbilitiesByName } from "./ability-lookup.ts";
export const lookupAbilityToolDefinition: DomainToolDefinition = {
  name: "lookup_ability",
  description:
    "查询指定途径的非凡能力列表。支持按途径序列查询、按序列名称查询、按能力名称搜索。\n\n" +
    "按途径序列查询时，高序列会自动累加显示从序列9起全部低序列能力。\n" +
    "追加 only=true 可只查看指定序列本身。\n\n" +
    "使用边界：玩家晋升后查询新获得序列的能力、查询 NPC 非凡者可能使用的能力。\n" +
    "禁区：代替 lookup（世界设定查询）或 lookup_novel（原著章节查询）。",
  parameters: Type.Object({
    query: Type.String({
      description:
        "查询字符串。支持三种格式：\n" +
        "  - 途径-序列：「占卜家途径-序列5」——高序列自动累加低序列能力\n" +
        "  - 序列名称：「秘偶大师」——自动识别所属途径与等级\n" +
        "  - 能力名称：「占卜」——搜索所有途径中匹配的能力\n" +
        "追加 only=true 可只看指定序列本身，不展示累积链。",
    }),
    only: Type.Optional(Type.Boolean({ description: "true 时只查指定等级，不累积显示低序列能力" })),
  }),
  execute: async (_toolCallId, params) => {
    const raw = isRecord(params) ? params : {};
    const query = typeof raw["query"] === "string" ? raw["query"] : "";
    const only = raw["only"] === true;
    const parsed = parseAbilityQuery(query, only);
    if (!parsed) {
      const searchResult = searchAbilitiesByName(query);
      if (searchResult) {
        return textResult(searchResult.text);
      }
      return textResult(
        [
          `无法解析查询「${query}」。`,
          "",
          "支持的格式：",
          '  - 途径-序列：  "占卜家途径-序列5"（高序列自动累加低序列能力）',
          '  - 序列名：    "秘偶大师"（自动识别所属途径）',
          '  - 能力名称：  "占卜"（搜索所有途径中匹配的能力）',
          "  - 追加 only=true 只显示该序列能力，不展示累积链。",
        ].join("\n"),
      );
    }
    const result = lookupAbility(parsed);
    return textResult(result.text);
  },
};
