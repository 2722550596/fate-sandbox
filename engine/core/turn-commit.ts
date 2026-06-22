import type { ActorConditionEvent, ActorConditionEventResult } from "./actor-condition.ts";
import type { ScenePresenceInput, ScenePresenceResult } from "./actor.ts";
import type { EconomyEvent, EconomyEventResult } from "./economy.ts";
import type { MemoryEvent, MemoryEventResult } from "./memory.ts";
import type { SceneEvent, SceneEventResult } from "./scene.ts";
import type { ServantFormEvent, ServantFormEventResult } from "./servant.ts";
import type { State, TurnTimePolicy } from "./state.ts";

import { updateActorCondition } from "./actor-condition.ts";
import { setScenePresence } from "./actor.ts";
import { updateEconomy } from "./economy.ts";
import { collectBackstageDueNotices } from "./faction-clock.ts";
import { recordMemory } from "./memory.ts";
import { assertNoOpenObligations } from "./obligations.ts";
import { updateScene } from "./scene.ts";
import { updateServantForm } from "./servant.ts";
import { appendTurnLogEntry } from "./turn-log.ts";
import { applyTurnTime } from "./turn-time.ts";
import { assertNonEmptyString } from "./typebox-validation.ts";

export type TurnCommitEvent =
  | { kind: "scene"; event: SceneEvent }
  | { kind: "scene-presence"; event: ScenePresenceInput }
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
  | { kind: "actor-condition"; result: ActorConditionEventResult }
  | { kind: "servant-form"; result: ServantFormEventResult }
  | { kind: "economy"; result: EconomyEventResult }
  | { kind: "memory"; result: MemoryEventResult };

export interface TurnCommitResult {
  message: string;
  results: TurnCommitEventResult[];
  warnings: string[];
}

export function commitTurn(draft: State, input: TurnCommitInput): TurnCommitResult {
  const summary = assertNonEmptyString(input.summary, "summary");
  const startedAt = draft.public.clock.currentAt;
  const timeResult = applyTurnTime(draft, input.time);
  const results = input.events.map((event) => applyTurnEvent(draft, event));
  // canonical commit 对账点：本轮裁决登记的义务必须在 events 里落地，
  // 账未清则整次 commit 拒绝回滚（backlog #4）。
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

function applyTurnEvent(draft: State, event: TurnCommitEvent): TurnCommitEventResult {
  switch (event.kind) {
    case "scene":
      return { kind: event.kind, result: updateScene(draft, event.event) };
    case "scene-presence":
      return { kind: event.kind, result: setScenePresence(draft, event.event) };
    case "actor-condition":
      return { kind: event.kind, result: updateActorCondition(draft, event.event) };
    case "servant-form":
      return { kind: event.kind, result: updateServantForm(draft, event.event) };
    case "economy":
      return { kind: event.kind, result: updateEconomy(draft, event.event) };
    case "memory":
      return { kind: event.kind, result: recordMemory(draft, event.event) };
    default:
      throw new Error("unreachable turn commit event kind");
  }
}

function collectWarnings(draft: State, input: TurnCommitInput): string[] {
  const warnings: string[] = [];
  warnings.push(...collectPacingWarnings(input));
  // 幕后催账：时间推进越过 dueAt / 时钟填满时，engine 直接在返回值里提醒（backlog #3）
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
