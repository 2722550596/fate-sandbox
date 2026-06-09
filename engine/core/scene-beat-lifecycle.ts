import type { ScenePresenceResult } from "./actor";
import type { MemoryClaim, MemoryEvent, MemoryEventResult } from "./memory";
import type {
  SceneBeatInput,
  SceneBeatResult,
  SceneBeatThreatInput,
  SceneBeatTransitionResult,
  SceneEventResult,
} from "./scene";
import type { ActorId, SituationKind, StoryBeatId, TurnTimePolicy } from "./state";

import { setScenePresence } from "./actor";
import { recordMemory } from "./memory";
import { beginSceneBeat, transitionSceneBeat, updateScene } from "./scene";
import { appendTurnLogEntry, createId, getState, transactState } from "./state";
import { applyTurnTime } from "./turn-time";

export interface SceneBeatActionPolicy {
  allowedActions?: string[];
  forbiddenEscalations?: string[];
  completionCriteria?: string[];
  nextBeatHints?: string[];
}

export interface SceneBeatPresenceInput {
  presentActorIds?: ActorId[];
  allyActorIds?: ActorId[];
}

export interface SceneBeatMemoryInput {
  title: string;
  summary: string;
  consequences?: string[];
  claims: MemoryClaim[];
}

export interface SceneBeatBeginInput {
  kind: "begin";
  title: string;
  objectives: string[];
  purpose: string;
  time: TurnTimePolicy;
  beatId?: StoryBeatId;
  actionPolicy?: SceneBeatActionPolicy;
  threats?: SceneBeatThreatInput[];
  presence?: SceneBeatPresenceInput;
  situation?: SituationKind;
}

export interface SceneBeatCompleteInput {
  kind: "complete";
  outcome: string;
  time: TurnTimePolicy;
  memory?: SceneBeatMemoryInput;
  nextBeat?: SceneBeatNextBeatInput | null;
  presence?: SceneBeatPresenceInput;
  situation?: SituationKind;
}

export interface SceneBeatNextBeatInput {
  title: string;
  objectives: string[];
  beatId?: StoryBeatId;
  actionPolicy?: SceneBeatActionPolicy;
  threats?: SceneBeatThreatInput[];
  presence?: SceneBeatPresenceInput;
  situation?: SituationKind;
}

export type SceneBeatProgressInput = SceneBeatBeginInput | SceneBeatCompleteInput;

export type SceneBeatProgressResult =
  | {
      kind: "begin";
      message: string;
      time: SceneEventResult;
      beat: SceneBeatResult;
    }
  | {
      kind: "complete";
      message: string;
      time: SceneEventResult;
      transition: SceneBeatTransitionResult;
      memory: MemoryEventResult | null;
      presence: ScenePresenceResult | null;
      situation: SceneEventResult | null;
    };

const DEFAULT_ALLOWED_ACTIONS = ["观察当前局势", "回应在场角色", "决定下一步行动"];

export function progressSceneBeat(input: SceneBeatProgressInput): SceneBeatProgressResult {
  return transactState(() => {
    switch (input.kind) {
      case "begin":
        return beginCurrentSceneBeat(input);
      case "complete":
        return completeCurrentSceneBeat(input);
      default:
        throw new Error("unreachable scene beat progress kind");
    }
  });
}

function beginCurrentSceneBeat(input: SceneBeatBeginInput): SceneBeatProgressResult {
  const startedAt = getState().public.clock.currentAt;
  const time = applyTurnTime(input.time);
  const beat = beginSceneBeat(buildBeginSceneBeatInput(input));
  appendTurnLogEntry({
    summary: input.purpose,
    startedAt,
    endedAt: getState().public.clock.currentAt,
    time: input.time,
    eventCount: 1,
    resultCount: 2,
  });
  return { kind: "begin", message: formatBeginMessage(time, beat), time, beat };
}

function completeCurrentSceneBeat(input: SceneBeatCompleteInput): SceneBeatProgressResult {
  const state = getState();
  const currentWindow = state.public.scene.storyWindow;
  if (currentWindow === null) {
    throw new Error(
      "progress_scene_beat complete 需要当前存在 Scene Beat。当前没有 active beat；复杂新场景请用 progress_scene_beat begin，非 Scene Beat lifecycle 的状态变化请用 commit_turn。",
    );
  }

  const startedAt = getState().public.clock.currentAt;
  const time = applyTurnTime(input.time);
  const transition = transitionSceneBeat({
    completedBeatId: currentWindow.currentBeatId,
    resolveAllObjectives: true,
    nextBeat: buildNextBeatInput(input, currentWindow.currentArcId, currentWindow.currentBeatId),
    reason: input.outcome,
  });
  const memory = input.memory === undefined ? null : recordMemory(buildMemoryEvent(input.memory));
  const presence = shouldApplyPostCompletionPresence(input)
    ? setScenePresence({
        presentActorIds: input.presence?.presentActorIds ?? getState().public.scene.presentActorIds,
        allyActorIds: input.presence?.allyActorIds ?? getState().public.allyActorIds,
        reason: input.outcome,
      })
    : null;
  const situation = shouldApplyPostCompletionSituation(input)
    ? updateScene({ kind: "set-situation", situation: input.situation, reason: input.outcome })
    : null;

  appendTurnLogEntry({
    summary: input.outcome,
    startedAt,
    endedAt: getState().public.clock.currentAt,
    time: input.time,
    eventCount: countCompleteInputEvents(input),
    resultCount: countCompleteResults(time, memory, presence, situation),
  });

  return {
    kind: "complete",
    message: formatCompleteMessage(time, transition, memory, presence, situation),
    time,
    transition,
    memory,
    presence,
    situation,
  };
}

function buildBeginSceneBeatInput(input: SceneBeatBeginInput): SceneBeatInput {
  return {
    storyWindow: {
      currentArcId: getState().public.scene.storyWindow?.currentArcId ?? "main",
      currentBeatId: input.beatId ?? createId("beat"),
      title: input.title,
      allowedActions: input.actionPolicy?.allowedActions ?? DEFAULT_ALLOWED_ACTIONS,
      forbiddenEscalations: input.actionPolicy?.forbiddenEscalations ?? [],
      completionCriteria: input.actionPolicy?.completionCriteria ?? input.objectives,
      nextBeatHints: input.actionPolicy?.nextBeatHints ?? [],
    },
    objectives: input.objectives,
    threats: input.threats,
    presentActorIds: input.presence?.presentActorIds,
    allyActorIds: input.presence?.allyActorIds,
    situation: input.situation,
    reason: input.purpose,
  };
}

function buildNextBeatInput(
  input: SceneBeatCompleteInput,
  currentArcId: string,
  currentBeatId: string,
): SceneBeatInput | null | undefined {
  if (input.nextBeat === undefined || input.nextBeat === null) {
    return input.nextBeat;
  }
  return {
    storyWindow: {
      currentArcId,
      currentBeatId: input.nextBeat.beatId ?? `${currentBeatId}-next`,
      title: input.nextBeat.title,
      allowedActions: input.nextBeat.actionPolicy?.allowedActions ?? DEFAULT_ALLOWED_ACTIONS,
      forbiddenEscalations: input.nextBeat.actionPolicy?.forbiddenEscalations ?? [],
      completionCriteria:
        input.nextBeat.actionPolicy?.completionCriteria ?? input.nextBeat.objectives,
      nextBeatHints: input.nextBeat.actionPolicy?.nextBeatHints ?? [],
    },
    objectives: input.nextBeat.objectives,
    threats: input.nextBeat.threats,
    presentActorIds: input.nextBeat.presence?.presentActorIds ?? input.presence?.presentActorIds,
    allyActorIds: input.nextBeat.presence?.allyActorIds ?? input.presence?.allyActorIds,
    situation: input.nextBeat.situation ?? input.situation,
    reason: input.outcome,
  };
}

function buildMemoryEvent(input: SceneBeatMemoryInput): MemoryEvent {
  return {
    kind: "record-major-event",
    title: input.title,
    summary: input.summary,
    consequences: input.consequences,
    claims: input.claims,
  };
}

function countCompleteInputEvents(input: SceneBeatCompleteInput): number {
  let count = 1;
  if (input.memory !== undefined) count += 1;
  if (shouldApplyPostCompletionPresence(input)) count += 1;
  if (shouldApplyPostCompletionSituation(input)) count += 1;
  return count;
}

function countCompleteResults(
  _time: SceneEventResult,
  memory: MemoryEventResult | null,
  presence: ScenePresenceResult | null,
  situation: SceneEventResult | null,
): number {
  let count = 2;
  if (memory !== null) count += 1;
  if (presence !== null) count += 1;
  if (situation !== null) count += 1;
  return count;
}

function shouldApplyPostCompletionPresence(input: SceneBeatCompleteInput): boolean {
  return input.nextBeat === undefined || input.nextBeat === null
    ? input.presence !== undefined
    : false;
}

function shouldApplyPostCompletionSituation(
  input: SceneBeatCompleteInput,
): input is SceneBeatCompleteInput & { situation: SituationKind } {
  return (input.nextBeat === undefined || input.nextBeat === null) && input.situation !== undefined;
}

function formatBeginMessage(time: SceneEventResult, beat: SceneBeatResult): string {
  return [
    time.message,
    beat.message,
    "叙事节奏：此工具已开启新的玩家行动窗口；接下来应停止前台推进，写出入口压力和可回应点。",
  ].join("\n");
}

function formatCompleteMessage(
  time: SceneEventResult,
  transition: SceneBeatTransitionResult,
  memory: MemoryEventResult | null,
  presence: ScenePresenceResult | null,
  situation: SceneEventResult | null,
): string {
  const lines = [time.message, transition.message];
  if (memory !== null) {
    lines.push("Campaign Memory 已记录。");
  }
  if (presence !== null) {
    lines.push(presence.message);
  }
  if (situation !== null) {
    lines.push(situation.message);
  }
  lines.push(
    "叙事节奏：此工具已收口当前 beat；除必要修复或后台落点外，不要在同一回复继续游玩 nextBeat。最终正文需写足收口过程、代价、NPC 反应与新窗口。",
  );
  return lines.join("\n");
}
