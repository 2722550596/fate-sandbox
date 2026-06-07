import type {
  CurrencyCode,
  LocationState,
  OpeningMode,
  RuleSetId,
  SituationKind,
  TimelineId,
  TimeZoneId,
} from "../../engine/core/state";

import { configureCampaign } from "../../engine/core/campaign";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";

export function configureCampaignTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => configureCampaign(assertConfigureCampaignInput(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function assertConfigureCampaignInput(params: unknown): Parameters<typeof configureCampaign>[0] {
  const input = assertRecord(params, "configure_campaign 参数");
  return {
    presetId: assertString(input["presetId"], "presetId"),
    title: optionalString(input["title"], "title"),
    timeline: optionalString(input["timeline"], "timeline") as TimelineId | undefined,
    openingMode: optionalString(input["openingMode"], "openingMode") as OpeningMode | undefined,
    premise: optionalString(input["premise"], "premise"),
    activeRuleSetIds: optionalStringArray(input["activeRuleSetIds"], "activeRuleSetIds") as
      | RuleSetId[]
      | undefined,
    timezone: optionalString(input["timezone"], "timezone") as TimeZoneId | undefined,
    startedAt: optionalString(input["startedAt"], "startedAt"),
    currentAt: optionalString(input["currentAt"], "currentAt"),
    location: optionalLocation(input["location"], "location"),
    situation: optionalString(input["situation"], "situation") as SituationKind | undefined,
    currency: optionalCurrency(input["currency"], "currency"),
    startingFunds: optionalInteger(input["startingFunds"], "startingFunds"),
    purseLabel: optionalString(input["purseLabel"], "purseLabel"),
    reason: assertString(input["reason"], "reason"),
  };
}

function optionalLocation(value: unknown, fieldName: string): LocationState | undefined {
  if (value === undefined) {
    return undefined;
  }
  const input = assertRecord(value, fieldName);
  return {
    region: assertString(input["region"], `${fieldName}.region`),
    site: assertString(input["site"], `${fieldName}.site`),
    detail: assertString(input["detail"], `${fieldName}.detail`),
    boundary: assertString(input["boundary"], `${fieldName}.boundary`) as LocationState["boundary"],
  };
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertString(value, fieldName);
}

function optionalCurrency(value: unknown, fieldName: string): CurrencyCode | undefined {
  const currency = optionalString(value, fieldName);
  if (currency === undefined) {
    return undefined;
  }
  const normalized = currency.toUpperCase();
  if (normalized === "PP" || normalized === "PPT" || currency === "サクラメント") {
    return "custom";
  }
  return currency as CurrencyCode; // safe: engine state assertion reports unsupported canonical currencies.
}

function optionalInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${fieldName} 必须是整数。`);
  }
  return value;
}

function optionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是字符串数组。`);
  }
  return value.map((entry, index) => assertString(entry, `${fieldName}.${index}`));
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
}
