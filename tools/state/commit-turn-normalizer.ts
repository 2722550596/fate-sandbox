import type { ScenePresenceInput } from "../../engine/core/actor";
import type { EconomyEvent } from "../../engine/core/economy";
import type { MemoryEvent } from "../../engine/core/memory";
import type { SceneEvent } from "../../engine/core/scene";
import type { ServantFormEvent } from "../../engine/core/servant";
import type { TurnCommitEvent, TurnCommitInput } from "../../engine/core/turn-commit";

import { parseTurnTimePolicySchema } from "../../engine/core/turn-time-schema";

import { normalizeActorConditionEvent } from "./actor-condition-normalizer";

const DEFAULT_SUMMARY = "本轮状态变化。";
const TURN_EVENT_KINDS = [
  "scene",
  "scene-presence",
  "actor-condition",
  "servant-form",
  "economy",
  "memory",
] as const;
const COMMIT_SCENE_EVENT_KINDS = [
  "set-location",
  "set-situation",
  "set-story-window",
  "clear-story-window",
  "add-objective",
  "resolve-objective",
  "add-threat",
  "clear-threat",
] as const;

export function normalizeTurnCommitInput(params: unknown): TurnCommitInput {
  const input = assertRecord(params, "commit_turn 参数");
  const rawEvents = assertArray(input["events"], "events");
  const time = parseTurnTimePolicySchema(input["time"], "time");
  const summary = normalizeSummary(input["summary"], rawEvents, time.reason);
  return {
    summary,
    time,
    events: rawEvents.map((event) => normalizeTurnCommitEvent(event, summary)),
  };
}

function normalizeTurnCommitEvent(value: unknown, summary: string): TurnCommitEvent {
  const event = assertRecord(value, "events[]");
  const normalizedKind = normalizeTurnEventKind(event["kind"]);
  switch (normalizedKind) {
    case "scene":
      return normalizeSceneTurnEvent(event, summary);
    case "scene-presence":
      return {
        kind: normalizedKind,
        event: normalizeScenePresenceInput(
          extractDomainEvent(event, "scene-presence.event"),
          summary,
        ),
      };
    case "actor-condition":
      return {
        kind: normalizedKind,
        event: normalizeActorConditionEvent(
          withReason(extractDomainEvent(event, "actor-condition.event"), summary),
          summary,
        ),
      };
    case "servant-form":
      return {
        kind: normalizedKind,
        event: trustDomainEvent<ServantFormEvent>(
          withReason(extractDomainEvent(event, "servant-form.event"), summary),
        ),
      };
    case "economy":
      return {
        kind: normalizedKind,
        event: trustDomainEvent<EconomyEvent>(
          withReason(extractDomainEvent(event, "economy.event"), summary),
        ),
      };
    case "memory":
      return { kind: normalizedKind, event: normalizeMemoryTurnEvent(event) };
    default:
      throw new Error(
        `非法 commit_turn event.kind: ${formatUnknown(event["kind"])}。允许: scene / scene-presence / actor-condition / servant-form / economy / memory。`,
      );
  }
}

function normalizeTurnEventKind(rawKind: unknown): TurnCommitEvent["kind"] {
  const kind = normalizeKindText(rawKind);
  for (const candidate of TURN_EVENT_KINDS) {
    if (kind === candidate) {
      return candidate;
    }
  }
  throw new Error(
    `非法 commit_turn event.kind: ${formatUnknown(rawKind)}。允许: ${TURN_EVENT_KINDS.join(" / ")}。`,
  );
}

function normalizeKindText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase().replace(/_/g, "-");
}

function extractDomainEvent(event: Record<string, unknown>, fieldName: string): Record<string, unknown> {
  if (isRecord(event["event"])) {
    return event["event"];
  }
  return assertRecord(event, fieldName);
}

function normalizeMemoryTurnEvent(event: Record<string, unknown>): MemoryEvent {
  return extractDomainEvent(event, "memory.event") as unknown as MemoryEvent;
}

function normalizeSceneTurnEvent(
  event: Record<string, unknown>,
  summary: string,
): TurnCommitEvent {
  const payload = normalizeSceneEventPayload(withReason(extractDomainEvent(event, "scene.event"), summary));
  if (payload["kind"] === "set-scene-presence") {
    return {
      kind: "scene-presence",
      event: normalizeScenePresenceInput(payload, summary),
    };
  }
  return { kind: "scene", event: payload as unknown as SceneEvent };
}

function normalizeSceneEventPayload(
  payload: Record<string, unknown> & { reason: string },
): Record<string, unknown> & { reason: string } {
  const kind = normalizeKindText(payload["kind"]);
  if (!COMMIT_SCENE_EVENT_KINDS.includes(kind as (typeof COMMIT_SCENE_EVENT_KINDS)[number])) {
    throw new Error(
      `非法 commit_turn scene.event.kind: ${formatUnknown(payload["kind"])}。允许: ${COMMIT_SCENE_EVENT_KINDS.join(" / ")}。`,
    );
  }
  if (kind !== "resolve-objective") {
    return { ...payload, kind };
  }
  return {
    ...payload,
    kind,
    objectiveId: normalizeOptionalString(payload["objectiveId"]) ?? undefined,
    objectiveSummary: normalizeOptionalString(payload["objectiveSummary"]) ?? undefined,
  };
}

function normalizeScenePresenceInput(
  input: Record<string, unknown>,
  summary: string,
): ScenePresenceInput {
  return {
    presentActorIds: normalizeStringArray(input["presentActorIds"], "presentActorIds", []),
    allyActorIds: normalizeStringArray(input["allyActorIds"], "allyActorIds", []),
    reason: normalizeReason(input["reason"], summary),
  };
}

function normalizeSummary(
  value: unknown,
  events: readonly unknown[],
  timeReason: string,
): string {
  const explicit = normalizeOptionalString(value);
  if (explicit !== null) {
    return explicit;
  }
  for (const event of events) {
    const reason = findReason(event);
    if (reason !== null) {
      return reason;
    }
  }
  if (timeReason.trim().length > 0) {
    return timeReason;
  }
  return DEFAULT_SUMMARY;
}

function findReason(event: unknown): string | null {
  if (!isRecord(event)) {
    return null;
  }
  const directReason = normalizeOptionalString(event["reason"]);
  if (directReason !== null) {
    return directReason;
  }
  const payload = event["event"];
  if (!isRecord(payload)) {
    return null;
  }
  const payloadReason = normalizeOptionalString(payload["reason"]);
  if (payloadReason !== null) {
    return payloadReason;
  }
  const input = payload["input"];
  if (!isRecord(input)) {
    return null;
  }
  return normalizeOptionalString(input["reason"]);
}

function withReason(event: Record<string, unknown>, summary: string): Record<string, unknown> & {
  reason: string;
} {
  return { ...event, reason: normalizeReason(event["reason"], summary) };
}

function normalizeReason(value: unknown, fallback: string): string {
  return normalizeOptionalString(value) ?? fallback;
}

function normalizeStringArray(
  value: unknown,
  fieldName: string,
  fallback: string[] | undefined,
): string[] {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }
  return assertArray(value, fieldName).map((entry) => assertNonEmptyString(entry, `${fieldName}[]`));
}

function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是字符串。`);
  }
  return value.trim();
}

function trustDomainEvent<T>(event: Record<string, unknown>): T {
  return event as unknown as T; // safe: tool adapter only normalizes common LLM omissions; owning engine module validates the domain event.
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是数组。`);
  }
  return value;
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}

function formatUnknown(value: unknown): string {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
