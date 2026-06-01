import type {
  ActorId,
  LocationState,
  SceneObjectiveId,
  SceneThreatId,
  SceneThreatSeverity,
  SituationKind,
  StoryBeatId,
  StoryWindowState,
} from "./state";

import { Temporal } from "@js-temporal/polyfill";

import { assertNonEmptyString, assertNonNegativeInteger, createId, updateState } from "./state";

const MIN_BEAT_OBJECTIVES = 1;
const MAX_BEAT_OBJECTIVES = 5;

export type SceneEvent =
  | { kind: "move-location"; location: LocationState; elapsedMinutes: number; reason: string }
  | { kind: "set-situation"; situation: SituationKind; reason: string }
  | { kind: "set-story-window"; storyWindow: StoryWindowState; reason: string }
  | { kind: "clear-story-window"; reason: string }
  | { kind: "add-objective"; summary: string; reason: string }
  | { kind: "resolve-objective"; objectiveId: SceneObjectiveId; reason: string }
  | { kind: "add-threat"; summary: string; severity: SceneThreatSeverity; reason: string }
  | { kind: "clear-threat"; threatId: SceneThreatId; reason: string };

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
  resolvedObjectiveIds: SceneObjectiveId[];
  nextBeat: SceneBeatInput | null;
  memoryPrompt?: string;
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
  const objectiveIds: SceneObjectiveId[] = [];
  const threatIds: SceneThreatId[] = [];
  updateState((draft) => {
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
  });
  return {
    message: `Scene Beat 已开始：${input.storyWindow.title}；目标 ${objectiveIds.length} 个。`,
    objectiveIds,
    threatIds,
  };
}

export function transitionSceneBeat(input: SceneBeatTransitionInput): SceneBeatTransitionResult {
  assertNonEmptyString(input.reason, "reason");
  const memoryPrompt = normalizeOptionalString(input.memoryPrompt);
  let nextBeat: SceneBeatResult | null = null;
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
    for (const objectiveId of input.resolvedObjectiveIds) {
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
      throw new Error(
        `无法 transition beat：仍有未解决目标 ${activeObjectives.map((objective) => objective.id).join(", ")}。`,
      );
    }
    draft.public.scene.storyWindow = null;
  });
  if (input.nextBeat !== null) {
    nextBeat = beginSceneBeat(input.nextBeat);
  }
  return {
    message: nextBeat === null ? "Scene Beat 已完成。" : `Scene Beat 已切换：${nextBeat.message}`,
    resolvedObjectiveIds: input.resolvedObjectiveIds,
    nextBeat,
    memoryPrompt,
  };
}

export function updateScene(event: SceneEvent): SceneEventResult {
  assertNonEmptyString(event.reason, "reason");
  switch (event.kind) {
    case "move-location":
      return moveLocation(event);
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
  const elapsedMinutes = assertNonNegativeInteger(event.elapsedMinutes, "elapsedMinutes");
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
    draft.public.scene.storyWindow = event.storyWindow;
  });
  return { message: `剧情窗口已更新：${event.storyWindow.title}。` };
}

function clearStoryWindow(): SceneEventResult {
  updateState((draft) => {
    draft.public.scene.storyWindow = null;
  });
  return { message: "剧情窗口已清除。" };
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

function resolveObjective(
  event: Extract<SceneEvent, { kind: "resolve-objective" }>,
): SceneEventResult {
  updateState((draft) => {
    const objective = draft.public.scene.objectives.find((entry) => entry.id === event.objectiveId);
    if (objective === undefined) {
      throw new Error(`目标不存在: ${event.objectiveId}`);
    }
    objective.status = "resolved";
  });
  return { message: `目标已解决：${event.objectiveId}。` };
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
