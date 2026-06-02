import type {
  ActorId,
  LocationState,
  SceneObjectiveId,
  SceneThreatId,
  SceneThreatSeverity,
  SituationKind,
  State,
  StoryBeatId,
  StoryWindowState,
} from "./state";

import { Temporal } from "@js-temporal/polyfill";

import { assertNonEmptyString, assertNonNegativeInteger, createId, updateState } from "./state";

const MIN_BEAT_OBJECTIVES = 1;
const MAX_BEAT_OBJECTIVES = 5;

export type SceneEvent =
  | { kind: "move-location"; location: LocationState; elapsedMinutes: number; reason: string }
  | { kind: "set-location"; location: LocationState; reason: string }
  | { kind: "set-situation"; situation: SituationKind; reason: string }
  | { kind: "set-story-window"; storyWindow: StoryWindowState; reason: string }
  | { kind: "clear-story-window"; reason: string }
  | { kind: "add-objective"; summary: string; reason: string }
  | {
      kind: "resolve-objective";
      objectiveId?: SceneObjectiveId;
      objectiveSummary?: string;
      reason: string;
    }
  | { kind: "add-threat"; summary: string; severity: SceneThreatSeverity; reason: string }
  | { kind: "clear-threat"; threatId: SceneThreatId; reason: string };

export type SceneBeatTurnEvent =
  | { kind: "begin-beat"; input: SceneBeatInput }
  | { kind: "transition-beat"; input: SceneBeatTransitionInput }
  | { kind: "move-location"; input: SceneBeatMoveInput };

export interface SceneBeatInput {
  storyWindow: StoryWindowState;
  objectives: string[];
  threats?: SceneBeatThreatInput[];
  presentActorIds?: ActorId[];
  allyActorIds?: ActorId[];
  situation?: SituationKind;
  reason: string;
}

export interface SceneBeatThreatInput {
  summary: string;
  severity: SceneThreatSeverity;
}

export interface SceneBeatTransitionInput {
  completedBeatId: StoryBeatId;
  resolvedObjectiveIds?: SceneObjectiveId[];
  resolvedObjectiveSummaries?: string[];
  resolveAllObjectives?: boolean;
  nextBeat?: SceneBeatInput | null;
  memoryPrompt?: string;
  reason: string;
}

export interface SceneBeatMoveInput {
  storyWindow: StoryWindowState;
  objectives: string[];
  threats?: SceneBeatThreatInput[];
  presentActorIds?: ActorId[];
  allyActorIds?: ActorId[];
  situation?: SituationKind;
  location: LocationState;
  elapsedMinutes: number;
  reason: string;
}

export interface SceneEventResult {
  message: string;
}

export interface SceneBeatResult {
  message: string;
  objectiveIds: SceneObjectiveId[];
  threatIds: SceneThreatId[];
}

export interface SceneBeatTransitionResult {
  message: string;
  resolvedObjectiveIds: SceneObjectiveId[];
  nextBeat: SceneBeatResult | null;
  memoryPrompt: string | null;
}

export function beginSceneBeat(input: SceneBeatInput): SceneBeatResult {
  assertNonEmptyString(input.reason, "reason");
  assertBeatObjectives(input.objectives);
  return beginSceneBeatUnchecked(input);
}

export function moveToSceneBeat(input: SceneBeatMoveInput): SceneBeatResult {
  const elapsedMinutes = assertPositiveElapsedMinutes(input.elapsedMinutes);
  assertNonEmptyString(input.reason, "reason");
  assertBeatObjectives(input.objectives);
  const objectiveIds: SceneObjectiveId[] = [];
  const threatIds: SceneThreatId[] = [];
  updateState((draft) => {
    const nextTime = Temporal.Instant.from(draft.public.clock.currentAt)
      .add({ minutes: elapsedMinutes })
      .toString();
    draft.public.clock.currentAt = nextTime;
    draft.public.scene.lastResolvedAt = nextTime;
    draft.public.scene.location = input.location;
    beginSceneBeatOnDraft(draft, input, objectiveIds, threatIds);
  });
  return {
    message: `已移动并开始 Scene Beat：${input.storyWindow.title}；经过 ${elapsedMinutes} 分钟；目标 ${objectiveIds.length} 个。`,
    objectiveIds,
    threatIds,
  };
}

function assertPositiveElapsedMinutes(value: unknown): number {
  const elapsedMinutes = assertNonNegativeInteger(value, "elapsedMinutes");
  if (elapsedMinutes === 0) {
    throw new Error(
      "非法elapsedMinutes: 0。移动或推进时间必须大于 0；若没有经过时间，请不要记录移动/时间推进事件。",
    );
  }
  return elapsedMinutes;
}

function beginSceneBeatUnchecked(input: SceneBeatInput): SceneBeatResult {
  const objectiveIds: SceneObjectiveId[] = [];
  const threatIds: SceneThreatId[] = [];
  updateState((draft) => {
    beginSceneBeatOnDraft(draft, input, objectiveIds, threatIds);
  });
  return {
    message: `Scene Beat 已开始：${input.storyWindow.title}；目标 ${objectiveIds.length} 个。`,
    objectiveIds,
    threatIds,
  };
}

function beginSceneBeatOnDraft(
  draft: State,
  input: SceneBeatInput,
  objectiveIds: SceneObjectiveId[],
  threatIds: SceneThreatId[],
): void {
  if (draft.public.scene.storyWindow !== null) {
    throw new Error(formatActiveBeatExistsError(draft.public.scene.storyWindow));
  }
  draft.public.scene.storyWindow = input.storyWindow;
  if (input.situation !== undefined) {
    draft.public.scene.situation = input.situation;
  }
  if (input.presentActorIds !== undefined) {
    assertActorsExist(draft.public.actors, input.presentActorIds, "presentActorIds");
    draft.public.scene.presentActorIds = uniqueActorIds(input.presentActorIds);
  }
  if (input.allyActorIds !== undefined) {
    assertActorsExist(draft.public.actors, input.allyActorIds, "allyActorIds");
    draft.public.allyActorIds = uniqueActorIds(input.allyActorIds);
  }
  draft.public.scene.objectives = input.objectives.map((summary) => {
    const id = createId("objective");
    objectiveIds.push(id);
    return { id, summary: assertNonEmptyString(summary, "objectives[]"), status: "active" };
  });
  draft.public.scene.threats = (input.threats ?? []).map((threat) => {
    const id = createId("threat");
    threatIds.push(id);
    return {
      id,
      summary: assertNonEmptyString(threat.summary, "threat.summary"),
      severity: threat.severity,
    };
  });
}

export function transitionSceneBeat(input: SceneBeatTransitionInput): SceneBeatTransitionResult {
  assertNonEmptyString(input.reason, "reason");
  const memoryPrompt = normalizeOptionalString(input.memoryPrompt);
  let nextBeat: SceneBeatResult | null = null;
  let resolvedObjectiveIds: SceneObjectiveId[] = [];
  updateState((draft) => {
    const currentWindow = draft.public.scene.storyWindow;
    if (currentWindow === null) {
      throw new Error(`无法 transition beat：当前没有 storyWindow。`);
    }
    if (currentWindow.currentBeatId !== input.completedBeatId) {
      throw new Error(
        `无法 transition beat：当前 beat 是 ${currentWindow.currentBeatId}，不是 ${input.completedBeatId}。`,
      );
    }
    const shouldResolveAll = shouldResolveAllObjectives(input);
    resolvedObjectiveIds = resolveObjectiveIds(
      draft.public.scene.objectives,
      input.resolvedObjectiveIds ?? [],
      input.resolvedObjectiveSummaries ?? [],
      shouldResolveAll,
    );
    for (const objectiveId of resolvedObjectiveIds) {
      const objective = draft.public.scene.objectives.find((entry) => entry.id === objectiveId);
      if (objective === undefined) {
        throw new Error(`目标不存在: ${objectiveId}`);
      }
      objective.status = "resolved";
    }
    const activeObjectives = draft.public.scene.objectives.filter(
      (objective) => objective.status !== "resolved",
    );
    if (activeObjectives.length > 0) {
      throw new Error(formatUnresolvedObjectivesError(activeObjectives));
    }
    clearBeatScopedSceneState(draft);
  });
  if (input.nextBeat !== undefined && input.nextBeat !== null) {
    nextBeat = beginSceneBeat(input.nextBeat);
  }
  return {
    message: nextBeat === null ? "Scene Beat 已完成。" : `Scene Beat 已切换：${nextBeat.message}`,
    resolvedObjectiveIds,
    nextBeat,
    memoryPrompt,
  };
}

export function updateScene(event: SceneEvent): SceneEventResult {
  assertNonEmptyString(event.reason, "reason");
  switch (event.kind) {
    case "move-location":
      return moveLocation(event);
    case "set-location":
      return setLocation(event);
    case "set-situation":
      return setSituation(event);
    case "set-story-window":
      return setStoryWindow(event);
    case "clear-story-window":
      return clearStoryWindow();
    case "add-objective":
      return addObjective(event);
    case "resolve-objective":
      return resolveObjective(event);
    case "add-threat":
      return addThreat(event);
    case "clear-threat":
      return clearThreat(event);
    default:
      throw new Error("unreachable scene event kind");
  }
}

function moveLocation(event: Extract<SceneEvent, { kind: "move-location" }>): SceneEventResult {
  const elapsedMinutes = assertPositiveElapsedMinutes(event.elapsedMinutes);
  updateState((draft) => {
    const nextTime = Temporal.Instant.from(draft.public.clock.currentAt)
      .add({ minutes: elapsedMinutes })
      .toString();
    draft.public.clock.currentAt = nextTime;
    draft.public.scene.lastResolvedAt = nextTime;
    draft.public.scene.location = event.location;
  });
  return { message: `地点已更新，经过 ${elapsedMinutes} 分钟。` };
}

function setLocation(event: Extract<SceneEvent, { kind: "set-location" }>): SceneEventResult {
  updateState((draft) => {
    draft.public.scene.location = event.location;
  });
  return { message: "地点已修正。" };
}

function setSituation(event: Extract<SceneEvent, { kind: "set-situation" }>): SceneEventResult {
  updateState((draft) => {
    draft.public.scene.situation = event.situation;
  });
  return { message: `态势已更新为 ${event.situation}。` };
}

function setStoryWindow(
  event: Extract<SceneEvent, { kind: "set-story-window" }>,
): SceneEventResult {
  updateState((draft) => {
    if (draft.public.scene.storyWindow !== null) {
      throw new Error(formatActiveBeatExistsError(draft.public.scene.storyWindow));
    }
    draft.public.scene.storyWindow = event.storyWindow;
  });
  return { message: `剧情窗口已更新：${event.storyWindow.title}。` };
}

function clearStoryWindow(): SceneEventResult {
  updateState((draft) => {
    clearBeatScopedSceneState(draft);
  });
  return { message: "剧情窗口已清除。" };
}

function clearBeatScopedSceneState(draft: State): void {
  draft.public.scene.storyWindow = null;
  draft.public.scene.objectives = [];
  draft.public.scene.threats = [];
}

function addObjective(event: Extract<SceneEvent, { kind: "add-objective" }>): SceneEventResult {
  const id = createId("objective");
  updateState((draft) => {
    draft.public.scene.objectives.push({
      id,
      summary: assertNonEmptyString(event.summary, "summary"),
      status: "active",
    });
  });
  return { message: `目标已加入：${id}。` };
}

function shouldResolveAllObjectives(input: SceneBeatTransitionInput): boolean {
  if (input.resolveAllObjectives === true) {
    return true;
  }
  return (
    input.resolveAllObjectives !== false &&
    (input.resolvedObjectiveIds?.length ?? 0) === 0 &&
    (input.resolvedObjectiveSummaries?.length ?? 0) === 0
  );
}

function resolveObjective(
  event: Extract<SceneEvent, { kind: "resolve-objective" }>,
): SceneEventResult {
  let resolvedObjectiveId: SceneObjectiveId;
  updateState((draft) => {
    const objectiveId = resolveSingleObjectiveId(
      draft.public.scene.objectives,
      event.objectiveId,
      event.objectiveSummary,
    );
    const objective = draft.public.scene.objectives.find((entry) => entry.id === objectiveId);
    if (objective === undefined) {
      throw new Error(formatObjectiveIdNotFoundError(objectiveId, draft.public.scene.objectives));
    }
    objective.status = "resolved";
    resolvedObjectiveId = objectiveId;
  });
  return { message: `目标已解决：${resolvedObjectiveId!}。` };
}

function resolveSingleObjectiveId(
  objectives: ReadonlyArray<{ id: SceneObjectiveId; summary: string }>,
  objectiveId: SceneObjectiveId | undefined,
  objectiveSummary: string | undefined,
): SceneObjectiveId {
  if (objectiveId !== undefined) {
    return assertNonEmptyString(objectiveId, "objectiveId");
  }
  if (objectiveSummary !== undefined) {
    const normalizedSummary = assertNonEmptyString(objectiveSummary, "objectiveSummary");
    const objective = findObjectiveBySummary(objectives, normalizedSummary);
    if (objective === undefined) {
      throw new Error(formatObjectiveSummaryNotFoundError(normalizedSummary, objectives));
    }
    return objective.id;
  }
  throw new Error(formatMissingObjectiveSelectorError(objectives));
}

function addThreat(event: Extract<SceneEvent, { kind: "add-threat" }>): SceneEventResult {
  const id = createId("threat");
  updateState((draft) => {
    draft.public.scene.threats.push({
      id,
      summary: assertNonEmptyString(event.summary, "summary"),
      severity: event.severity,
    });
  });
  return { message: `威胁已加入：${id}。` };
}

function clearThreat(event: Extract<SceneEvent, { kind: "clear-threat" }>): SceneEventResult {
  updateState((draft) => {
    const before = draft.public.scene.threats.length;
    draft.public.scene.threats = draft.public.scene.threats.filter(
      (threat) => threat.id !== event.threatId,
    );
    if (draft.public.scene.threats.length === before) {
      throw new Error(`威胁不存在: ${event.threatId}`);
    }
  });
  return { message: `威胁已清除：${event.threatId}。` };
}

function resolveObjectiveIds(
  objectives: ReadonlyArray<{ id: SceneObjectiveId; summary: string }>,
  ids: readonly SceneObjectiveId[],
  summaries: readonly string[],
  resolveAllObjectives: boolean,
): SceneObjectiveId[] {
  if (resolveAllObjectives) {
    return objectives.map((objective) => objective.id);
  }
  const resolved = new Set<SceneObjectiveId>();
  for (const id of ids) {
    resolved.add(assertNonEmptyString(id, "resolvedObjectiveIds[]"));
  }
  for (const summary of summaries) {
    const normalizedSummary = assertNonEmptyString(summary, "resolvedObjectiveSummaries[]");
    const objective = findObjectiveBySummary(objectives, normalizedSummary);
    if (objective === undefined) {
      throw new Error(formatObjectiveSummaryNotFoundError(normalizedSummary, objectives));
    }
    resolved.add(objective.id);
  }
  return [...resolved];
}

function findObjectiveBySummary(
  objectives: ReadonlyArray<{ id: SceneObjectiveId; summary: string }>,
  summary: string,
): { id: SceneObjectiveId; summary: string } | undefined {
  const exact = objectives.find((entry) => entry.summary === summary);
  if (exact !== undefined) {
    return exact;
  }
  return objectives.find(
    (entry) => entry.summary.includes(summary) || summary.includes(entry.summary),
  );
}

function formatActiveBeatExistsError(storyWindow: StoryWindowState): string {
  return [
    `无法开始新的 Scene Beat：当前已有 active beat ${storyWindow.currentBeatId}（${storyWindow.title}）。`,
    "同一时间只能有一个 active storyWindow；请先使用 finish_current_beat 完成当前 beat，或用 transitionSceneBeat 关闭当前 beat 后再开启下一个。",
  ].join("\n");
}

function formatUnresolvedObjectivesError(
  objectives: ReadonlyArray<{ id: SceneObjectiveId; summary: string }>,
): string {
  return [
    "无法 transition beat：仍有未解决目标。",
    "可用 resolvedObjectiveSummaries 或 resolveAllObjectives=true。",
    ...objectives.map((objective) => `- ${objective.id}: ${objective.summary}`),
  ].join("\n");
}

function formatObjectiveIdNotFoundError(
  objectiveId: SceneObjectiveId,
  objectives: ReadonlyArray<{ id: SceneObjectiveId; summary: string }>,
): string {
  return [
    `目标不存在: ${objectiveId}`,
    "可用 objectiveId / objectiveSummary：",
    ...objectives.map((objective) => `- ${objective.id}: ${objective.summary}`),
  ].join("\n");
}

function formatMissingObjectiveSelectorError(
  objectives: ReadonlyArray<{ id: SceneObjectiveId; summary: string }>,
): string {
  return [
    "resolve-objective 必须提供 objectiveId 或 objectiveSummary。",
    "如果当前 beat 已全部完成，优先使用 finish_current_beat；非常规组合才用 commit_turn 内部 scene-beat transition-beat。",
    "可用 objectiveId / objectiveSummary：",
    ...objectives.map((objective) => `- ${objective.id}: ${objective.summary}`),
  ].join("\n");
}

function formatObjectiveSummaryNotFoundError(
  summary: string,
  objectives: ReadonlyArray<{ id: SceneObjectiveId; summary: string }>,
): string {
  return [
    `目标摘要不存在: ${summary}`,
    "可用目标摘要：",
    ...objectives.map((objective) => `- ${objective.summary}`),
  ].join("\n");
}

function assertBeatObjectives(objectives: readonly string[]): void {
  if (objectives.length < MIN_BEAT_OBJECTIVES || objectives.length > MAX_BEAT_OBJECTIVES) {
    throw new Error(
      `Scene Beat 需要 ${MIN_BEAT_OBJECTIVES}-${MAX_BEAT_OBJECTIVES} 个 Scene Objective，当前 ${objectives.length} 个。`,
    );
  }
}

function assertActorsExist(
  actors: Readonly<Record<ActorId, unknown>>,
  actorIds: readonly ActorId[],
  fieldName: string,
): void {
  for (const actorId of actorIds) {
    if (actors[actorId] === undefined) {
      throw new Error(`${fieldName} 包含不存在的 actor: ${actorId}`);
    }
  }
}

function uniqueActorIds(actorIds: readonly ActorId[]): ActorId[] {
  return [...new Set(actorIds.map((actorId) => assertNonEmptyString(actorId, "actorId")))];
}

function normalizeOptionalString(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  return assertNonEmptyString(value, "memoryPrompt");
}
