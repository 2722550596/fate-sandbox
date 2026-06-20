/**
 * Engine-side parallel-line input assembler（backlog #5）。
 *
 * GM 只需提供 `lineId + timeWindow + optional hints`，其余字段由 engine
 * 从 secret state、actor agenda、offscreenEventLog、pressure palette 自动装配，
 * 减少泄密、降低懒得调子代理的门槛、稳定后台世界运动。
 */

import type { TimelinePressureSlot } from "../../data/timeline-pressure-palettes.ts";
import type {
  ActorAgendaState,
  OffscreenEvent,
  ParallelLineInput,
  ParallelLinePressureSlotHint,
  ParallelLineRecentEvent,
  State,
} from "./state.ts";

import { getTimelinePressureSlots } from "../../data/timeline-pressure-palettes.ts";
import { assertNonEmptyString } from "./typebox-validation.ts";

export interface AssembleParallelLineInput {
  lineId: string;
  timeWindow: { start: string; end: string };
  /** 可选：覆盖自动推断的 currentArc/currentBeat */
  currentArc?: string;
  currentBeat?: string;
  /** 可选偏好 */
  preferredPressureType?: string;
  excludedActorIds?: string[];
  excludedPressureTypes?: string[];
  majorBeatEnd?: boolean;
  arcTransition?: boolean;
  /** 可选追加 knownFacts（叠加 engine 自动提取的） */
  additionalKnownFacts?: string[];
  additionalPrivateFacts?: string[];
  /** 可选追加 allowedScope / forbiddenEscalations */
  allowedScope?: string[];
  forbiddenEscalations?: string[];
  /** 可选：GM 手写一行 previousLineState 覆盖 engine 自动拼 */
  previousLineState?: string;
  /** 可选：手写 playerSideSummary 覆盖 engine 自动拼 */
  playerSideSummary?: string;
}

const RECENT_OFFSCREEN_LIMIT = 6;
const MAX_KNOWN_FACTS = 12;
const MAX_PRIVATE_FACTS = 8;

export function assembleParallelLineInput(
  state: State,
  input: AssembleParallelLineInput,
): ParallelLineInput {
  const lineId = assertNonEmptyString(input.lineId, "lineId");
  const timeline = state.public.campaign.timeline;

  const recentOffscreenEvents = buildRecentOffscreenEvents(state);
  const activePressurePalette = buildPressurePalette(timeline, recentOffscreenEvents);

  const storyWindow = state.public.scene.storyWindow;
  const currentArc = input.currentArc ?? storyWindow?.currentArcId ?? "ongoing";
  const currentBeat = input.currentBeat ?? storyWindow?.currentBeatId ?? "open";

  return {
    lineId,
    timelineId: timeline,
    genreContract: `${timeline} genre rules apply.`,
    activePressurePalette,
    timeWindow: {
      start: assertNonEmptyString(input.timeWindow.start, "timeWindow.start"),
      end: assertNonEmptyString(input.timeWindow.end, "timeWindow.end"),
    },
    currentArc,
    currentBeat,
    allowedScope: input.allowedScope ?? [],
    forbiddenEscalations: buildForbiddenEscalations(state, input),
    knownFacts: buildKnownFacts(state, input),
    privateFacts: buildPrivateFacts(state, input),
    actorGoals: buildActorGoals(state),
    previousLineState: input.previousLineState ?? buildPreviousLineState(state, lineId),
    playerSideSummary: input.playerSideSummary ?? buildPlayerSideSummary(state),
    recentOffscreenEvents,
    excludedActorIds: input.excludedActorIds,
    excludedPressureTypes: input.excludedPressureTypes,
    preferredPressureType: input.preferredPressureType,
    majorBeatEnd: input.majorBeatEnd,
    arcTransition: input.arcTransition,
  };
}

function buildRecentOffscreenEvents(state: State): ParallelLineRecentEvent[] {
  return state.secrets.offscreenEventLog.slice(-RECENT_OFFSCREEN_LIMIT).map((event) => ({
    lineId: event.lineId,
    actorIds: event.actorIds,
    pressureType: classifyPressureType(event),
    summary: event.summary,
  }));
}

function classifyPressureType(event: OffscreenEvent): string {
  const haystack = `${event.actorIds.join(" ")} ${event.summary}`.toLowerCase();
  if (
    /police|government|faldeus|orlando|calatin|karatin|监测|封锁|巡逻|警方|警察|媒体|政府/.test(
      haystack,
    )
  )
    return "authority-surveillance";
  if (/church|executor|hansa|kotomine|教会|代行者|监督者/.test(haystack))
    return "church-supervision";
  if (/clock tower|association|el-melloi|时钟塔|协会|魔术师协会|贵族|专利/.test(haystack))
    return "mage-association-politics";
  if (
    /workshop|bounded field|leyline|familiar|caster|工房|结界|灵脉|使魔|术式|魔术师/.test(haystack)
  )
    return "magecraft-infrastructure";
  if (
    /servant|saber|archer|lancer|rider|caster|assassin|berserker|从者|英灵|宝具|真名/.test(haystack)
  )
    return "servant-autonomy";
  if (/civilian|school|hospital|news|rumor|市民|学校|医院|新闻|传闻|社交|交通/.test(haystack))
    return "civilian-society";
  if (
    /dream|disease|curse|origin|dead apostle|vampire|梦|疾病|诅咒|起源|死徒|吸血鬼/.test(haystack)
  )
    return "occult-contagion";
  if (/land|forest|temple|desert|crater|土地|森林|寺|沙漠|陨坑|地脉/.test(haystack))
    return "territory-environment";
  return "other";
}

function buildPressurePalette(
  timeline: State["public"]["campaign"]["timeline"],
  recentEvents: readonly ParallelLineRecentEvent[],
): ParallelLinePressureSlotHint[] {
  const recentPressureTypes = recentEvents.map((event) => event.pressureType);
  return getTimelinePressureSlots(timeline).map((slot) => toSlotHint(slot, recentPressureTypes));
}

function toSlotHint(
  slot: TimelinePressureSlot,
  recentPressureTypes: readonly string[],
): ParallelLinePressureSlotHint {
  const recentUses = recentPressureTypes.filter((type) => type === slot.pressureType).length;
  const windowStart = Math.max(0, recentPressureTypes.length - slot.cooldownTurns);
  const coolingDown =
    slot.cooldownTurns > 0 && recentPressureTypes.slice(windowStart).includes(slot.pressureType);
  return { ...slot, recentUses, coolingDown };
}

function buildKnownFacts(state: State, input: AssembleParallelLineInput): string[] {
  const facts: string[] = [];
  // 从 public memory 提取最近事件标题
  for (const event of state.public.memory.eventLog.slice(-5)) {
    facts.push(`${event.title}: ${event.summary}`);
  }
  // 从 pinnedFacts 取关键 world/faction
  for (const fact of state.public.memory.pinnedFacts) {
    if (fact.scope === "world" || fact.scope === "faction") {
      facts.push(fact.text);
    }
  }
  if (input.additionalKnownFacts !== undefined) {
    facts.push(...input.additionalKnownFacts);
  }
  return facts.slice(-MAX_KNOWN_FACTS);
}

function buildPrivateFacts(state: State, input: AssembleParallelLineInput): string[] {
  const facts: string[] = [];
  // 从 secret campaign facts
  for (const secret of state.secrets.campaignSecrets) {
    if (secret.revealState !== "revealed") {
      facts.push(secret.text);
    }
  }
  if (input.additionalPrivateFacts !== undefined) {
    facts.push(...input.additionalPrivateFacts);
  }
  return facts.slice(-MAX_PRIVATE_FACTS);
}

function buildActorGoals(state: State): string[] {
  return Object.values(state.secrets.actorAgendas).map((agenda) => formatAgendaGoal(agenda));
}

function formatAgendaGoal(agenda: ActorAgendaState): string {
  const order = agenda.currentOrder === null ? "" : ` (order: ${agenda.currentOrder})`;
  return `${agenda.actorId}: goal=${agenda.goal}, fear=${agenda.fear}${order}`;
}

function buildForbiddenEscalations(state: State, input: AssembleParallelLineInput): string[] {
  const escalations =
    input.forbiddenEscalations !== undefined ? [...input.forbiddenEscalations] : [];
  // storyWindow.forbiddenEscalations 自动注入
  if (state.public.scene.storyWindow !== null) {
    for (const forbidden of state.public.scene.storyWindow.forbiddenEscalations) {
      if (!escalations.includes(forbidden)) {
        escalations.push(forbidden);
      }
    }
  }
  return escalations;
}

function buildPreviousLineState(state: State, lineId: string): string {
  const matching = state.secrets.offscreenEventLog.filter((event) => event.lineId === lineId);
  const latest = matching.at(-1);
  if (latest === undefined) {
    return "No previous line state recorded.";
  }
  return `Latest ${lineId} event: ${latest.summary} (${latest.timeRange.start} – ${latest.timeRange.end})`;
}

function buildPlayerSideSummary(state: State): string {
  const protagonist = state.public.actors[state.public.protagonistActorId];
  if (protagonist === undefined) return "Player state unknown.";
  const location = formatLocation(state);
  const situation = state.public.scene.situation;
  const wounds = protagonist.condition.wounds.length;
  const allies = state.public.allyActorIds
    .map((id) => state.public.actors[id]?.presentation.renderName ?? id)
    .join(", ");
  return `${protagonist.presentation.renderName} at ${location} (${situation}). Wounds: ${wounds}. Allies: ${allies.length > 0 ? allies : "none"}.`;
}

function formatLocation(state: State): string {
  const location = state.public.scene.location;
  return [location.region, location.site, location.detail]
    .filter((part) => part.length > 0)
    .join(" · ");
}
