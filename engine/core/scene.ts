import type {
  LocationState,
  SceneObjectiveId,
  SceneThreatId,
  SceneThreatSeverity,
  SituationKind,
} from "./state";

import { Temporal } from "@js-temporal/polyfill";

import { assertNonEmptyString, assertNonNegativeInteger, createId, updateState } from "./state";

export type SceneEvent =
  | { kind: "move-location"; location: LocationState; elapsedMinutes: number; reason: string }
  | { kind: "set-situation"; situation: SituationKind; reason: string }
  | { kind: "add-objective"; summary: string; reason: string }
  | { kind: "resolve-objective"; objectiveId: SceneObjectiveId; reason: string }
  | { kind: "add-threat"; summary: string; severity: SceneThreatSeverity; reason: string }
  | { kind: "clear-threat"; threatId: SceneThreatId; reason: string };

export interface SceneEventResult {
  message: string;
}

export function updateScene(event: SceneEvent): SceneEventResult {
  assertNonEmptyString(event.reason, "reason");
  switch (event.kind) {
    case "move-location":
      return moveLocation(event);
    case "set-situation":
      return setSituation(event);
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
