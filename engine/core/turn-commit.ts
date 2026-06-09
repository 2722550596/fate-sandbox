import type { ScenePresenceInput, ScenePresenceResult } from "./actor";
import type { ActorConditionEvent, ActorConditionEventResult } from "./actor-condition";
import type { EconomyEvent, EconomyEventResult } from "./economy";
import type { MemoryEvent, MemoryEventResult } from "./memory";
import type {
  SceneBeatResult,
  SceneBeatTransitionResult,
  SceneBeatTurnEvent,
  SceneEvent,
  SceneEventResult,
} from "./scene";
import type { ServantFormEvent, ServantFormEventResult } from "./servant";
import type { TurnTimePolicy } from "./state";

import { setScenePresence } from "./actor";
import { updateActorCondition } from "./actor-condition";
import { updateEconomy } from "./economy";
import { recordMemory } from "./memory";
import { beginSceneBeat, transitionSceneBeat, updateScene } from "./scene";
import { updateServantForm } from "./servant";
import { appendTurnLogEntry, assertNonEmptyString, getState, transactState } from "./state";
import { applyTurnTime } from "./turn-time";

export type TurnCommitEvent =
  | { kind: "scene"; event: SceneEvent }
  | { kind: "scene-presence"; event: ScenePresenceInput }
  | { kind: "scene-beat"; event: SceneBeatTurnEvent }
  | { kind: "actor-condition"; event: ActorConditionEvent }
  | { kind: "servant-form"; event: ServantFormEvent }
  | { kind: "economy"; event: EconomyEvent }
  | { kind: "memory"; event: MemoryEvent };

export interface TurnCommitInput {
  summary: string;
  time: TurnTimePolicy;
  events: TurnCommitEvent[];
}

export type TurnCommitEventResult =
  | { kind: "scene"; result: SceneEventResult }
  | { kind: "scene-presence"; result: ScenePresenceResult }
  | { kind: "scene-beat"; result: SceneBeatResult | SceneBeatTransitionResult }
  | { kind: "actor-condition"; result: ActorConditionEventResult }
  | { kind: "servant-form"; result: ServantFormEventResult }
  | { kind: "economy"; result: EconomyEventResult }
  | { kind: "memory"; result: MemoryEventResult };

export interface TurnCommitResult {
  message: string;
  results: TurnCommitEventResult[];
  warnings: string[];
}

export function commitTurn(input: TurnCommitInput): TurnCommitResult {
  return transactState(() => commitCanonicalTurn(input));
}

function commitCanonicalTurn(input: TurnCommitInput): TurnCommitResult {
  const summary = assertNonEmptyString(input.summary, "summary");
  const startedAt = getState().public.clock.currentAt;
  const timeResult = applyTurnTime(input.time);
  const results = input.events.map(applyTurnEvent);
  const timeResults = [{ kind: "scene" as const, result: timeResult }];
  const autoCloseResult = closeCompletedOpenStoryWindow();
  const baseResults = [...timeResults, ...results];
  const finalResults = autoCloseResult === null ? baseResults : [...baseResults, autoCloseResult];
  appendTurnLogEntry({
    summary,
    startedAt,
    endedAt: getState().public.clock.currentAt,
    time: input.time,
    eventCount: input.events.length,
    resultCount: finalResults.length,
  });
  const warnings = collectWarnings(input);
  return {
    message: formatMessage(summary, finalResults, warnings),
    results: finalResults,
    warnings,
  };
}

function applyTurnEvent(event: TurnCommitEvent): TurnCommitEventResult {
  switch (event.kind) {
    case "scene":
      return { kind: event.kind, result: updateScene(event.event) };
    case "scene-presence":
      return { kind: event.kind, result: setScenePresence(event.event) };
    case "scene-beat":
      return { kind: event.kind, result: applySceneBeatEvent(event.event) };
    case "actor-condition":
      return { kind: event.kind, result: updateActorCondition(event.event) };
    case "servant-form":
      return { kind: event.kind, result: updateServantForm(event.event) };
    case "economy":
      return { kind: event.kind, result: updateEconomy(event.event) };
    case "memory":
      return { kind: event.kind, result: recordMemory(event.event) };
    default:
      throw new Error("unreachable turn commit event kind");
  }
}

function applySceneBeatEvent(
  event: SceneBeatTurnEvent,
): SceneBeatResult | SceneBeatTransitionResult {
  switch (event.kind) {
    case "begin-beat":
      return beginSceneBeat(event.input);
    case "transition-beat":
      return transitionSceneBeat(event.input);
    default:
      throw new Error("unreachable scene beat event kind");
  }
}

function closeCompletedOpenStoryWindow(): TurnCommitEventResult | null {
  const state = getState();
  const storyWindow = state.public.scene.storyWindow;
  if (storyWindow === null) {
    return null;
  }
  const activeObjectives = state.public.scene.objectives.filter(
    (objective) => objective.status !== "resolved",
  );
  if (activeObjectives.length > 0) {
    return null;
  }
  return {
    kind: "scene",
    result: updateScene({
      kind: "clear-story-window",
      reason: `Scene Beat「${storyWindow.title}」的目标已全部解决，自动收束当前剧情窗口。`,
    }),
  };
}

function collectWarnings(input: TurnCommitInput): string[] {
  const state = getState();
  const warnings: string[] = [];
  const storyWindow = state.public.scene.storyWindow;
  if (storyWindow !== null) {
    const unresolvedObjectives = state.public.scene.objectives.filter(
      (objective) => objective.status !== "resolved",
    );
    if (unresolvedObjectives.length === 0) {
      warnings.push(`剧情窗口仍在进行，但当前没有未解决的 Scene Objective：${storyWindow.title}。`);
    }
  }
  warnings.push(...collectPacingWarnings(input));
  return warnings;
}

function collectPacingWarnings(input: TurnCommitInput): string[] {
  const warnings: string[] = [];
  if (input.events.length >= 3) {
    warnings.push(
      "叙事节奏：本轮已有多个领域事件；请停止继续推进下一前台回合，先把当前动作、代价、NPC 反应和新风险写足。",
    );
  }
  if (input.time.elapsedMinutes > 30) {
    warnings.push(
      "叙事节奏：本轮已推进较长时间；除必要的后台记录外，请不要继续游玩下一个行动窗口。",
    );
  }
  return warnings;
}

function formatMessage(
  summary: string,
  results: TurnCommitEventResult[],
  warnings: readonly string[],
): string {
  const lines = [`回合已提交：${summary}`, `领域事件：${results.length}`];
  if (warnings.length > 0) {
    lines.push("检查提醒：", ...warnings.map((warning) => `- ${warning}`));
  }
  return lines.join("\n");
}
