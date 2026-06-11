import type { Static } from "typebox";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  CURRENCY_CODE_SCHEMA,
  OPENING_MODE_SCHEMA,
  RULE_SET_ID_SCHEMA,
  SITUATION_KIND_SCHEMA,
  TIMELINE_ID_SCHEMA,
  TIMEZONE_ID_SCHEMA,
} from "./state-enum-schemas.ts";
import { LOCATION_STATE_SCHEMA } from "./turn-time-schema.ts";
import { parseTypeBoxValue, trimStringsDeep } from "./typebox-validation.ts";

/**
 * configure_campaign 工具边界 schema：单一事实来源。
 * ConfigureCampaignInput 类型由此派生（campaign.ts re-export 原名）。
 * tools/registry.ts 的 parameters 故意保持松，不引用这里。
 */
export const CONFIGURE_CAMPAIGN_INPUT_SCHEMA = Type.Object({
  presetId: Type.String({ minLength: 1 }),
  title: Type.Optional(Type.String({ minLength: 1 })),
  timeline: Type.Optional(TIMELINE_ID_SCHEMA),
  openingMode: Type.Optional(OPENING_MODE_SCHEMA),
  premise: Type.Optional(Type.String({ minLength: 1 })),
  activeRuleSetIds: Type.Optional(Type.Array(RULE_SET_ID_SCHEMA)),
  timezone: Type.Optional(TIMEZONE_ID_SCHEMA),
  startedAt: Type.Optional(Type.String({ minLength: 1 })),
  currentAt: Type.Optional(Type.String({ minLength: 1 })),
  location: Type.Optional(LOCATION_STATE_SCHEMA),
  situation: Type.Optional(SITUATION_KIND_SCHEMA),
  currency: Type.Optional(CURRENCY_CODE_SCHEMA),
  startingFunds: Type.Optional(Type.Integer()),
  purseLabel: Type.Optional(Type.String({ minLength: 1 })),
  reason: Type.String({ minLength: 1 }),
});

export type ConfigureCampaignInput = Static<typeof CONFIGURE_CAMPAIGN_INPUT_SCHEMA>;

const CONFIGURE_CAMPAIGN_INPUT_VALIDATOR = Compile(CONFIGURE_CAMPAIGN_INPUT_SCHEMA);

export function parseConfigureCampaignInput(value: unknown): ConfigureCampaignInput {
  return parseTypeBoxValue(
    trimStringsDeep(value),
    "configure_campaign 参数",
    CONFIGURE_CAMPAIGN_INPUT_VALIDATOR,
  );
}
