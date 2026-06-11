import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { CurrencyCode } from "../../engine/core/state.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { configureCampaign } from "../../engine/core/campaign.ts";
import { parseConfigureCampaignInput } from "../../engine/core/campaign-schema.ts";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner.ts";
import { isRecord } from "../../engine/core/typebox-validation.ts";

/** Moon Cell 等时间线的货币别名归一化——这是领域归一化，不是校验。 */
const CURRENCY_ALIASES: Readonly<Record<string, CurrencyCode>> = {
  PP: "custom",
  PPT: "custom",
  サクラメント: "custom",
};

export function configureCampaignTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      configureCampaign(draft, parseConfigureCampaignInput(normalizeCurrencyAlias(params))),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function normalizeCurrencyAlias(params: unknown): unknown {
  if (!isRecord(params) || typeof params["currency"] !== "string") {
    return params;
  }
  const alias = CURRENCY_ALIASES[params["currency"].trim().toUpperCase()];
  if (alias === undefined) {
    return params;
  }
  return { ...params, currency: alias };
}

export const configureCampaignToolDefinition: FsnToolDefinition = {
  name: "configure_campaign",
  description:
    "配置开局 campaign preset、时间线、本地时区、起始时间、地点和经济规则；这是进入正式剧情前的第一步，也可用于修正当前存档的 campaign 元数据。\n\n" +
    "【必须调用的场景】\n" +
    "- 开局确认时间线/城市/本地时区/货币/开场地点后，正式剧情推进前\n" +
    "- 用户把 FSN 改成 FSF、EXTRA、空境、月姬或 custom 线，需要同步 campaign 与 clock\n" +
    "- 当前存档 campaign.timeline/timezone 与实际地点不一致，需要热修\n\n" +
    "【严禁的行为】\n" +
    "- 在剧情中随意改时间线或时区来逃避后果\n" +
    "- 用它替代 Scene Beat 或普通地点移动；复杂 beat 用 progress_scene_beat，普通移动用 commit_turn\n" +
    "- 未写 reason 就修改 campaign 语义",
  parameters: Type.Object({
    presetId: Type.String({
      description:
        "fsn_2004_fuyuki / fsf_2008_snowfield / extra_2032_seraph / extra_ccc_2032_far_side",
    }),
    title: Type.Optional(Type.String()),
    timeline: Type.Optional(
      Type.String({ description: "fsn / fsf / extra / extra-ccc / custom 等" }),
    ),
    openingMode: Type.Optional(Type.String({ description: "random / selected / custom" })),
    premise: Type.Optional(Type.String()),
    activeRuleSetIds: Type.Optional(Type.Array(Type.String())),
    timezone: Type.Optional(Type.String({ description: "Asia/Tokyo / America/Denver / UTC" })),
    startedAt: Type.Optional(Type.String({ description: "UTC ISO instant" })),
    currentAt: Type.Optional(Type.String({ description: "UTC ISO instant" })),
    location: Type.Optional(
      Type.Object({
        region: Type.String(),
        site: Type.String(),
        detail: Type.String(),
        boundary: Type.String({
          description: "normal / bounded-field / reality-marble / otherworld",
        }),
      }),
    ),
    situation: Type.Optional(Type.String()),
    currency: Type.Optional(Type.String({ description: "JPY / USD / custom" })),
    startingFunds: Type.Optional(Type.Integer()),
    purseLabel: Type.Optional(Type.String()),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    configureCampaignTool(params, ctx.sessionManager),
};
