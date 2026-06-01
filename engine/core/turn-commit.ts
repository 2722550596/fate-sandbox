import type { ActorConditionEvent, ActorConditionEventResult } from "./actor-condition";
import type { EconomyEvent, EconomyEventResult } from "./economy";
import type { MemoryEvent, MemoryEventResult } from "./memory";
import type {
  SceneBeatInput,
  SceneBeatMoveInput,
  SceneBeatResult,
  SceneBeatTransitionInput,
  SceneBeatTransitionResult,
  SceneBeatTurnEvent,
  SceneEvent,
  SceneEventResult,
} from "./scene";
import type { ServantFormEvent, ServantFormEventResult } from "./servant";

import { updateActorCondition } from "./actor-condition";
import { updateEconomy } from "./economy";
import { recordMemory } from "./memory";
import { beginSceneBeat, moveToSceneBeat, transitionSceneBeat, updateScene } from "./scene";
import { updateServantForm } from "./servant";
import { assertNonEmptyString, getState } from "./state";

type WithOptionalReason<T> = T extends { reason: string }
  ? Omit<T, "reason"> & { reason?: string }
  : T;

type SceneBeatTurnInputEvent =
  | { kind: "begin-beat"; input: WithOptionalReason<SceneBeatInput> }
  | { kind: "transition-beat"; input: WithOptionalReason<SceneBeatTransitionInput> }
  | { kind: "move-location"; input: WithOptionalReason<SceneBeatMoveInput> }
  | (WithOptionalReason<SceneBeatInput> & { kind: "begin-beat" })
  | (WithOptionalReason<SceneBeatTransitionInput> & { kind: "transition-beat" })
  | (WithOptionalReason<SceneBeatMoveInput> & { kind: "move-location" });

export type TurnCommitEvent =
  | { kind: "scene"; event: WithOptionalReason<SceneEvent> }
  | { kind: "scene-beat"; event: SceneBeatTurnInputEvent }
  | { kind: "actor-condition"; event: WithOptionalReason<ActorConditionEvent> }
  | { kind: "servant-form"; event: WithOptionalReason<ServantFormEvent> }
  | { kind: "economy"; event: WithOptionalReason<EconomyEvent> }
  | { kind: "memory"; event: MemoryEvent };

export interface TurnCommitInput {
  summary: string;
  events: TurnCommitEvent[];
}

export type TurnCommitHydratedEvent =
  | { kind: "scene"; event: SceneEvent }
  | { kind: "scene-beat"; event: SceneBeatTurnEvent }
  | { kind: "actor-condition"; event: ActorConditionEvent }
  | { kind: "servant-form"; event: ServantFormEvent }
  | { kind: "economy"; event: EconomyEvent }
  | { kind: "memory"; event: MemoryEvent };

export interface TurnCommitHydratedInput {
  summary: string;
  events: TurnCommitHydratedEvent[];
}

export type TurnCommitEventResult =
  | { kind: "scene"; result: SceneEventResult }
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
  return commitHydratedTurn(hydrateTurnCommitInput(input));
}

function hydrateTurnCommitInput(input: TurnCommitInput): TurnCommitHydratedInput {
  const summary = assertNonEmptyString(input.summary, "summary");
  return {
    summary,
    events: input.events.map((event) => hydrateTurnCommitEvent(event, summary)),
  };
}

function hydrateTurnCommitEvent(event: TurnCommitEvent, summary: string): TurnCommitHydratedEvent {
  switch (event.kind) {
    case "scene":
      return { kind: event.kind, event: withDefaultReason(event.event, summary) };
    case "scene-beat":
      return { kind: event.kind, event: withSceneBeatDefaultReason(event.event, summary) };
    case "actor-condition":
      return { kind: event.kind, event: withDefaultReason(event.event, summary) };
    case "servant-form":
      return { kind: event.kind, event: withDefaultReason(event.event, summary) };
    case "economy":
      return { kind: event.kind, event: withDefaultReason(event.event, summary) };
    case "memory":
      return { kind: event.kind, event: event.event };
    default:
      throw new Error("unreachable turn commit event kind");
  }
}

function withDefaultReason<T extends object>(event: T, summary: string): T & { reason: string } {
  const reason = "reason" in event ? event.reason : undefined;
  const normalizedReason =
    typeof reason === "string" && reason.trim().length > 0 ? reason : summary;
  return { ...event, reason: normalizedReason };
}

function withSceneBeatDefaultReason(
  event: SceneBeatTurnInputEvent,
  summary: string,
): SceneBeatTurnEvent {
  switch (event.kind) {
    case "begin-beat": {
      const input = "input" in event ? event.input : event;
      return { kind: event.kind, input: withDefaultReason(input, summary) };
    }
    case "transition-beat": {
      const input = "input" in event ? event.input : event;
      return { kind: event.kind, input: withDefaultReason(input, summary) };
    }
    case "move-location": {
      const input = "input" in event ? event.input : event;
      return { kind: event.kind, input: withDefaultReason(input, summary) };
    }
    default:
      throw new Error("unreachable scene beat event kind");
  }
}

function commitHydratedTurn(input: TurnCommitHydratedInput): TurnCommitResult {
  if (input.events.length === 0) {
    throw new Error("commit_turn 至少需要一个领域事件；若本轮没有状态变化，请不要调用。");
  }

  const results = input.events.map(applyTurnEvent);
  const warnings = collectWarnings();
  return {
    message: formatMessage(input.summary, results, warnings),
    results,
    warnings,
  };
}

function applyTurnEvent(event: TurnCommitHydratedEvent): TurnCommitEventResult {
  switch (event.kind) {
    case "scene":
      return { kind: event.kind, result: updateScene(event.event) };
    case "scene-beat":
      return {
        kind: event.kind,
        result: applySceneBeatEvent(event.event),
      };
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
    case "move-location":
      return moveToSceneBeat(event.input);
    default:
      throw new Error("unreachable scene beat event kind");
  }
}

function collectWarnings(): string[] {
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
