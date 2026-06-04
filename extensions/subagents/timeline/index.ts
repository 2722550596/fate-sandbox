import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";

import { lookupTool } from "../../../tools/lookup/lookup";

interface TimelineStateContext {
  currentAt: string;
  timezone: string;
  displayTime: string;
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
  actors: ActorContext[];
  recentOffscreenEvents: OffscreenEventContext[];
}

interface ActorContext {
  actorId: string;
  displayName: string;
  kind: string;
  stance: string;
  wounds: number;
  afflictions: number;
  servantModifiers: number;
}

interface OffscreenEventContext {
  lineId: string;
  actorIds: string[];
  timeRange: { start: string; end: string };
  visibility: string;
  pressureType: string;
  summary: string;
  consequences: string[];
  futureHooks: string[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const STATE_PATH = join(PROJECT_ROOT, "state", "state.json");
const RECENT_OFFSCREEN_LIMIT = 6;

export default function timelineSubagentsExtension(pi: ExtensionAPI): void {
  pi.on("before_agent_start", async (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${buildTimelineStateInjection()}`,
  }));

  pi.registerTool({
    name: "lookup",
    label: "lookup",
    description:
      "查询型月世界的权威设定。仅用于 subagent 核对当前世界线相关公开设定；不要用它读取或修改 canonical state。",
    parameters: Type.Object({
      query: Type.String({
        description: "搜索关键词——角色名、地点名、概念名等；多关键词用空格分隔，不要写整句。",
      }),
    }),
    execute: async (_toolCallId, params) => lookupTool(params),
  });
}

function buildTimelineStateInjection(): string {
  try {
    const raw: unknown = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
    const state = selectStateRecord(raw);
    const context = buildTimelineStateContext(state);
    return [
      "<timeline_state_context>",
      "以下是当前 canonical state 的子代理安全摘要，由 extension 自动注入；不要要求主 GM 重复提供，也不要把本段原样写给玩家。",
      "parallel-line 必须先检查 recentOffscreenEvents，避免连续重复同一 actor/faction/pressureType；如果最近已连续使用同一压力类型，优先换成当前 timeline 的其它生态位或返回 no-change/blocked。",
      "所有输出 timeRange.start/end 必须是 ISO UTC 字符串；displayTime 只是本地展示时间，不得把本地时钟当 UTC。timeRange.end 不得晚于 currentAt。",
      JSON.stringify(context, null, 2),
      "</timeline_state_context>",
    ].join("\n");
  } catch (error) {
    return [
      "<timeline_state_context>",
      `当前 state/state.json 读取失败：${formatError(error)}。不要假装知道幕后事件；如输入也没有提供 recentOffscreenEvents，重复路线风险应标为 riskFlags。`,
      "</timeline_state_context>",
    ].join("\n");
  }
}

function buildTimelineStateContext(state: Record<string, unknown>): TimelineStateContext {
  const publicState = requireRecord(state["public"], "state.public");
  const secrets = requireRecord(state["secrets"], "state.secrets");
  const campaign = requireRecord(publicState["campaign"], "public.campaign");
  const clock = requireRecord(publicState["clock"], "public.clock");
  const scene = requireRecord(publicState["scene"], "public.scene");
  const actors = requireRecord(publicState["actors"], "public.actors");
  const offscreenEventLog = optionalArray(secrets["offscreenEventLog"]);

  return {
    currentAt: requireString(clock["currentAt"], "clock.currentAt"),
    timezone: requireString(clock["timezone"], "clock.timezone"),
    displayTime:
      optionalString(clock["displayTime"]) ?? requireString(clock["currentAt"], "clock.currentAt"),
    timeRangeRule:
      "所有 timeRange.start/end 必须使用 ISO UTC；displayTime 是本地展示时间，不是 UTC；timeRange.end <= currentAt。",
    campaign: {
      title: requireString(campaign["title"], "campaign.title"),
      timeline: requireString(campaign["timeline"], "campaign.timeline"),
      premise: requireString(campaign["premise"], "campaign.premise"),
    },
    scene: {
      location: formatLocation(requireRecord(scene["location"], "scene.location")),
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

function actorContext(actorId: string, value: unknown): ActorContext {
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

function offscreenEventContext(value: unknown, index: number): OffscreenEventContext {
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

function formatLocation(location: Record<string, unknown>): string {
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

function selectStateRecord(raw: unknown): Record<string, unknown> {
  const root = requireRecord(raw, "state root");
  const nestedState = optionalRecord(root["state"]);
  return nestedState ?? root;
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

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
