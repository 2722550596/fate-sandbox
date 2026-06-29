import type { ActingResult } from "../actor/acting.ts";
import type { ActorConditionEvent, ActorConditionEventResult } from "../actor/actor-condition.ts";
import type { ActingEvent, SequenceInput } from "../actor/actor-schema.ts";
import type { ScenePresenceInput, ScenePresenceResult } from "../actor/actor.ts";
import type { EconomyEvent, EconomyEventResult } from "../economy/economy.ts";
import type { TrackedItemEvent } from "../inventory/tracked-item-schema.ts";
import type { TrackedItemEventResult } from "../inventory/tracked-item.ts";
import type { MemoryEvent, MemoryEventResult } from "../knowledge/memory.ts";
import type { SceneEvent, SceneEventResult } from "../scene/scene.ts";
import type { OutfitState, State, TurnTimePolicy } from "../state/state.ts";

import { recordActing } from "../actor/acting.ts";
import { updateActorCondition } from "../actor/actor-condition.ts";
import { changeActorOutfit } from "../actor/actor-impression.ts";
import { setScenePresence, upsertActor } from "../actor/actor.ts";
import { collectBackstageDueNotices } from "../backstage/faction-clock.ts";
import { updateEconomy } from "../economy/economy.ts";
import { applyTrackedItemEvent } from "../inventory/tracked-item.ts";
import { recordMemory } from "../knowledge/memory.ts";
import { assertNoOpenObligations, settleOldestObligation } from "../ledger/obligations.ts";
import { updateScene } from "../scene/scene.ts";
import { assertNonEmptyString } from "../utils/typebox-validation.ts";
import { appendTurnLogEntry } from "./turn-log.ts";
import { applyTurnTime } from "./turn-time.ts";

export type SequenceEvent = SequenceInput;

export interface SequenceEventResult {
  message: string;
}

export interface OutfitTurnEvent {
  actorId: string;
  outfit: OutfitState;
  reason: string;
}

export type TurnCommitEvent =
  | { kind: "scene"; event: SceneEvent }
  | { kind: "scene-presence"; event: ScenePresenceInput }
  | { kind: "actor-condition"; event: ActorConditionEvent }
  | { kind: "tracked-item"; event: TrackedItemEvent }
  | { kind: "sequence"; event: SequenceEvent }
  | { kind: "economy"; event: EconomyEvent }
  | { kind: "memory"; event: MemoryEvent }
  | { kind: "outfit"; event: OutfitTurnEvent }
  | { kind: "acting"; event: ActingEvent };

export interface TurnCommitInput {
  summary: string;
  time: TurnTimePolicy;
  events: TurnCommitEvent[];
}

export type TurnCommitEventResult =
  | { kind: "scene"; result: SceneEventResult }
  | { kind: "scene-presence"; result: ScenePresenceResult }
  | { kind: "actor-condition"; result: ActorConditionEventResult }
  | { kind: "tracked-item"; result: TrackedItemEventResult }
  | { kind: "sequence"; result: SequenceEventResult }
  | { kind: "economy"; result: EconomyEventResult }
  | { kind: "memory"; result: MemoryEventResult }
  | { kind: "outfit"; result: { message: string } }
  | { kind: "acting"; result: ActingResult };

export interface TurnCommitResult {
  message: string;
  results: TurnCommitEventResult[];
  warnings: string[];
}

export function commitTurn(draft: State, input: TurnCommitInput): TurnCommitResult {
  const summary = assertNonEmptyString(input.summary, "summary");
  const startedAt = draft.public.clock.currentAt;
  const timeResult = applyTurnTime(draft, input.time);
  const results = input.events.map((event) => applyTurnEvent(draft, event, summary));
  assertNoOpenObligations(draft);
  const timeResults = [{ kind: "scene" as const, result: timeResult }];
  const finalResults = [...timeResults, ...results];
  appendTurnLogEntry(draft, {
    summary,
    startedAt,
    endedAt: draft.public.clock.currentAt,
    time: input.time,
    eventCount: input.events.length,
    resultCount: finalResults.length,
  });
  const warnings = collectWarnings(draft, input);
  return {
    message: formatMessage(summary, finalResults, warnings),
    results: finalResults,
    warnings,
  };
}

function applyTurnEvent(
  draft: State,
  event: TurnCommitEvent,
  _summary: string,
): TurnCommitEventResult {
  switch (event.kind) {
    case "scene":
      return { kind: event.kind, result: updateScene(draft, event.event) };
    case "scene-presence":
      return { kind: event.kind, result: setScenePresence(draft, event.event) };
    case "actor-condition":
      return { kind: event.kind, result: updateActorCondition(draft, event.event) };
    case "tracked-item":
      return { kind: event.kind, result: applyTrackedItemEvent(draft, event.event) };
    case "sequence":
      return { kind: event.kind, result: applySequenceEvent(draft, event.event, _summary) };
    case "economy":
      return { kind: event.kind, result: updateEconomy(draft, event.event) };
    case "memory":
      return { kind: event.kind, result: recordMemory(draft, event.event) };
    case "outfit":
      return {
        kind: event.kind,
        result: changeActorOutfit(
          draft,
          event.event.actorId,
          event.event.outfit,
          event.event.reason,
        ),
      };
    case "acting":
      return { kind: event.kind, result: recordActing(draft, event.event) };
    default:
      throw new Error("unreachable turn commit event kind");
  }
}

function applySequenceEvent(
  draft: State,
  event: SequenceEvent,
  reason: string,
): SequenceEventResult {
  const result = upsertActor(draft, {
    kind: "upsert-sequence",
    sequence: event,
    reason,
  });
  settleOldestObligation(draft, ["sequence"]);
  return { message: result.message };
}

function collectWarnings(draft: State, input: TurnCommitInput): string[] {
  const warnings: string[] = [];
  warnings.push(...collectPacingWarnings(input));
  warnings.push(...collectBackstageDueNotices(draft));
  return warnings;
}

function collectPacingWarnings(input: TurnCommitInput): string[] {
  const warnings: string[] = [];
  if (input.events.length >= 3) {
    warnings.push(
      "叙事节奏：本轮已有多个领域事件；请停止压入下一前台冲突，先把当前意图、代价、NPC 反应和自然可接的新局面写足。",
    );
  }
  if (input.time.elapsedMinutes > 30) {
    warnings.push(
      "叙事节奏：本轮已推进较长时间；除必要的后台记录外，请不要继续游玩下一个前台冲突。",
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
