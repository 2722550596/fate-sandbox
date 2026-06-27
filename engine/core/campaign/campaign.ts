import type { State } from "../state/state.ts";
import type { ConfigureCampaignInput } from "./campaign-schema.ts";

import { getCampaignPreset } from "../../../data/campaign-presets.ts";
import { normalizeIsoInstant } from "../state/date-time.ts";
import { createId } from "../utils/ids.ts";
import { assertNonEmptyString } from "../utils/typebox-validation.ts";

export type { ConfigureCampaignInput } from "./campaign-schema.ts";

export interface ConfigureCampaignResult {
  message: string;
}

export function configureCampaign(
  draft: State,
  input: ConfigureCampaignInput,
): ConfigureCampaignResult {
  const reason = assertNonEmptyString(input.reason, "reason");
  const preset = getCampaignPreset(input.presetId);
  const title = input.title ?? preset.title;
  const timeline = input.timeline ?? preset.timeline;
  const openingMode = input.openingMode ?? preset.openingMode;
  const premise = input.premise ?? preset.premise;
  const activeRuleSetIds = input.activeRuleSetIds ?? preset.activeRuleSetIds;
  const timezone = input.timezone ?? preset.timezone;
  const startedAt = normalizeIsoInstant(input.startedAt ?? preset.startedAt, "startedAt");
  const currentAt = normalizeIsoInstant(
    input.currentAt ?? input.startedAt ?? preset.currentAt,
    "currentAt",
  );
  const location = input.location ?? preset.location;
  const situation = input.situation ?? preset.situation;
  const currency = input.currency ?? preset.economy.currency;
  const startingFunds = input.startingFunds ?? preset.economy.startingFunds;
  const purseLabel = input.purseLabel ?? preset.economy.purseLabel;
  draft.public.campaign = {
    title,
    timeline,
    openingMode,
    premise,
    activeRuleSetIds,
  };
  draft.public.clock.startedAt = startedAt;
  draft.public.clock.currentAt = currentAt;
  draft.public.clock.timezone = timezone;
  draft.public.clock.lastLongRestAt = null;
  draft.public.scene.location = location;
  draft.public.scene.situation = situation;
  draft.public.scene.lastResolvedAt = currentAt;
  draft.public.economy.currency = currency;
  draft.public.economy.accessibleFunds = [
    {
      id: "purse-protagonist-cash",
      ownerActorId: draft.public.protagonistActorId,
      label: purseLabel,
      amount: startingFunds,
      access: "held",
    },
  ];
  draft.public.memory.pinnedFacts = [
    ...draft.public.memory.pinnedFacts.filter((fact) => fact.id !== "fact-campaign-configured"),
    {
      id: "fact-campaign-configured",
      scope: "world",
      subject: "campaign",
      text: `Campaign 已配置：${title}；timeline=${timeline}；timezone=${timezone}。${reason}`,
      since: currentAt,
      sourceEventId: null,
    },
  ];
  draft.public.memory.eventLog.push({
    id: createId(draft, "event"),
    time: currentAt,
    title: "Campaign 配置",
    summary: reason,
    consequences: [`当前时间线: ${timeline}`, `本地时区: ${timezone}`],
  });

  return { message: `Campaign 已配置：${title} (${timeline}, ${timezone})。` };
}
