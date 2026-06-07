import type { TimeZoneId } from "./state";

import { formatHumanTime } from "./date-time";

export interface TimelineStateContext {
  currentAt: string;
  currentAtUtc: string;
  timezone: string;
  displayTime: string;
  currentLocalTime: string;
  timeRangeRule: string;
  campaign: {
    title: string;
    timeline: string;
    premise: string;
  };
  scene: {
    location: string;
    situation: string;
    presentActorIds: string[];
    objectives: string[];
    threats: string[];
  };
  actors: TimelineActorContext[];
  recentOffscreenEvents: TimelineOffscreenEventContext[];
}

export interface TimelineActorContext {
  actorId: string;
  displayName: string;
  kind: string;
  stance: string;
  wounds: number;
  afflictions: number;
  servantModifiers: number;
}

export interface TimelineOffscreenEventContext {
  lineId: string;
  actorIds: string[];
  timeRange: { start: string; end: string };
  visibility: string;
  pressureType: string;
  summary: string;
  consequences: string[];
  futureHooks: string[];
}

export interface StateExclusionDigest {
  clock: {
    currentAt: string;
    timezone: string;
    displayTime: string;
  };
  campaign: {
    title: string;
    timeline: string;
    premise: string;
  };
  scene: {
    location: string;
    situation: string;
    presentActorIds: string[];
    objectiveIds: string[];
    threatIds: string[];
  };
  actorIds: string[];
  offscreenEventIds: string[];
}

const RECENT_OFFSCREEN_LIMIT = 6;

export function buildTimelineStateContextFromRaw(raw: unknown): TimelineStateContext {
  const state = selectStateRecord(raw);
  const publicState = requireRecord(state["public"], "state.public");
  const secrets = requireRecord(state["secrets"], "state.secrets");
  const campaign = requireRecord(publicState["campaign"], "public.campaign");
  const clock = requireRecord(publicState["clock"], "public.clock");
  const scene = requireRecord(publicState["scene"], "public.scene");
  const actors = requireRecord(publicState["actors"], "public.actors");
  const offscreenEventLog = optionalArray(secrets["offscreenEventLog"]);
  const currentAt = requireString(clock["currentAt"], "clock.currentAt");
  const timezone = requireTimezone(clock["timezone"], "clock.timezone");
  const displayTime = formatHumanTime(currentAt, timezone).display;

  return {
    currentAt,
    currentAtUtc: currentAt,
    timezone,
    displayTime,
    currentLocalTime: displayTime,
    timeRangeRule: `所有 timeWindow/timeRange.start/end 必须使用 ISO UTC；当前 UTC ${currentAt} = ${timezone} 本地 ${displayTime}；不得把本地时钟直接加 Z 输出；timeRange.end <= currentAt。`,
    campaign: {
      title: requireString(campaign["title"], "campaign.title"),
      timeline: requireString(campaign["timeline"], "campaign.timeline"),
      premise: requireString(campaign["premise"], "campaign.premise"),
    },
    scene: {
      location: formatStateFileLocation(requireRecord(scene["location"], "scene.location")),
      situation: requireString(scene["situation"], "scene.situation"),
      presentActorIds: stringArray(scene["presentActorIds"], "scene.presentActorIds"),
      objectives: formatObjectives(optionalArray(scene["objectives"])),
      threats: formatThreats(optionalArray(scene["threats"])),
    },
    actors: Object.entries(actors).map(([actorId, actor]) => actorContext(actorId, actor)),
    recentOffscreenEvents: offscreenEventLog
      .slice(-RECENT_OFFSCREEN_LIMIT)
      .map((event, index) => offscreenEventContext(event, index)),
  };
}

export function buildStateExclusionDigestFromRaw(raw: unknown): StateExclusionDigest {
  const state = selectStateRecord(raw);
  const publicState = requireRecord(state["public"], "state.public");
  const secrets = requireRecord(state["secrets"], "state.secrets");
  const campaign = requireRecord(publicState["campaign"], "public.campaign");
  const clock = requireRecord(publicState["clock"], "public.clock");
  const scene = requireRecord(publicState["scene"], "public.scene");
  const actors = requireRecord(publicState["actors"], "public.actors");
  const currentAt = requireString(clock["currentAt"], "clock.currentAt");
  const timezone = requireTimezone(clock["timezone"], "clock.timezone");
  return {
    clock: {
      currentAt,
      timezone,
      displayTime:
        optionalString(clock["displayTime"]) ?? formatHumanTime(currentAt, timezone).display,
    },
    campaign: {
      title: requireString(campaign["title"], "campaign.title"),
      timeline: requireString(campaign["timeline"], "campaign.timeline"),
      premise: requireString(campaign["premise"], "campaign.premise"),
    },
    scene: {
      location: formatStateFileLocation(requireRecord(scene["location"], "scene.location")),
      situation: requireString(scene["situation"], "scene.situation"),
      presentActorIds: stringArray(scene["presentActorIds"], "scene.presentActorIds"),
      objectiveIds: objectIdArray(optionalArray(scene["objectives"]), "scene.objectives"),
      threatIds: objectIdArray(optionalArray(scene["threats"]), "scene.threats"),
    },
    actorIds: Object.keys(actors),
    offscreenEventIds: objectIdArray(
      optionalArray(secrets["offscreenEventLog"]),
      "offscreenEventLog",
    ),
  };
}

function actorContext(actorId: string, value: unknown): TimelineActorContext {
  const actor = requireRecord(value, `actors.${actorId}`);
  const presentation = requireRecord(actor["presentation"], `actors.${actorId}.presentation`);
  const relationship = requireRecord(
    actor["relationshipToProtagonist"],
    `actors.${actorId}.relationshipToProtagonist`,
  );
  const condition = requireRecord(actor["condition"], `actors.${actorId}.condition`);
  const servantForm = optionalRecord(actor["servantForm"]);
  const parameters = servantForm === null ? null : optionalRecord(servantForm["parameters"]);
  return {
    actorId,
    displayName: requireString(presentation["displayName"], `actors.${actorId}.displayName`),
    kind: requireString(actor["kind"], `actors.${actorId}.kind`),
    stance: requireString(relationship["stance"], `actors.${actorId}.stance`),
    wounds: optionalArray(condition["wounds"]).length,
    afflictions: optionalArray(condition["afflictions"]).length,
    servantModifiers: parameters === null ? 0 : optionalArray(parameters["modifiers"]).length,
  };
}

function offscreenEventContext(value: unknown, index: number): TimelineOffscreenEventContext {
  const event = requireRecord(value, `offscreenEventLog[${index}]`);
  const timeRange = requireRecord(event["timeRange"], `offscreenEventLog[${index}].timeRange`);
  const actorIds = stringArray(event["actorIds"], `offscreenEventLog[${index}].actorIds`);
  const summary = requireString(event["summary"], `offscreenEventLog[${index}].summary`);
  return {
    lineId: requireString(event["lineId"], `offscreenEventLog[${index}].lineId`),
    actorIds,
    timeRange: {
      start: requireString(timeRange["start"], `offscreenEventLog[${index}].timeRange.start`),
      end: requireString(timeRange["end"], `offscreenEventLog[${index}].timeRange.end`),
    },
    visibility: requireString(event["visibility"], `offscreenEventLog[${index}].visibility`),
    pressureType: classifyPressureType(actorIds, summary),
    summary,
    consequences: stringArray(event["consequences"], `offscreenEventLog[${index}].consequences`),
    futureHooks: stringArray(event["futureHooks"], `offscreenEventLog[${index}].futureHooks`),
  };
}

function classifyPressureType(actorIds: readonly string[], summary: string): string {
  const haystack = `${actorIds.join(" ")} ${summary}`.toLowerCase();
  if (
    /police|government|faldeus|orlando|calatin|karatin|监测|封锁|巡逻|警方|警察|媒体|政府/.test(
      haystack,
    )
  ) {
    return "authority-surveillance";
  }
  if (/church|executor|hansa|kotomine|教会|代行者|监督者/.test(haystack)) {
    return "church-supervision";
  }
  if (/clock tower|association|el-melloi|时钟塔|协会|魔术师协会|贵族|专利/.test(haystack)) {
    return "mage-association-politics";
  }
  if (
    /workshop|bounded field|leyline|familiar|caster|工房|结界|灵脉|使魔|术式|魔术师/.test(haystack)
  ) {
    return "magecraft-infrastructure";
  }
  if (
    /servant|saber|archer|lancer|rider|caster|assassin|berserker|从者|英灵|宝具|真名/.test(haystack)
  ) {
    return "servant-autonomy";
  }
  if (/civilian|school|hospital|news|rumor|市民|学校|医院|新闻|传闻|社交|交通/.test(haystack)) {
    return "civilian-society";
  }
  if (
    /dream|disease|curse|origin|dead apostle|vampire|梦|疾病|诅咒|起源|死徒|吸血鬼/.test(haystack)
  ) {
    return "occult-contagion";
  }
  if (/land|forest|temple|desert|crater|土地|森林|寺|沙漠|陨坑|地脉/.test(haystack)) {
    return "territory-environment";
  }
  return "other";
}

function formatStateFileLocation(location: Record<string, unknown>): string {
  return ["region", "site", "detail"]
    .map((key) => optionalString(location[key]))
    .filter((part) => part !== undefined && part.length > 0)
    .join(" · ");
}

function formatObjectives(values: readonly unknown[]): string[] {
  return values.map((value, index) => {
    const objective = requireRecord(value, `scene.objectives[${index}]`);
    return `${requireString(objective["id"], "objective.id")}: ${requireString(objective["summary"], "objective.summary")}`;
  });
}

function formatThreats(values: readonly unknown[]): string[] {
  return values.map((value, index) => {
    const threat = requireRecord(value, `scene.threats[${index}]`);
    return `${requireString(threat["severity"], "threat.severity")}: ${requireString(threat["summary"], "threat.summary")}`;
  });
}

function objectIdArray(values: readonly unknown[], fieldName: string): string[] {
  return values.map((value, index) => {
    const record = requireRecord(value, `${fieldName}[${index}]`);
    return requireString(record["id"], `${fieldName}[${index}].id`);
  });
}

function selectStateRecord(raw: unknown): Record<string, unknown> {
  const root = requireRecord(raw, "state root");
  const nestedState = optionalRecord(root["state"]);
  return nestedState ?? root;
}

function requireTimezone(value: unknown, fieldName: string): TimeZoneId {
  const timezone = requireString(value, fieldName);
  if (timezone === "Asia/Tokyo" || timezone === "America/Denver" || timezone === "UTC") {
    return timezone;
  }
  throw new Error(`${fieldName} 不支持: ${timezone}。`);
}

function requireRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}

function optionalRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是字符串数组。`);
  }
  return value.map((entry) => requireString(entry, `${fieldName}[]`));
}

function optionalArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
