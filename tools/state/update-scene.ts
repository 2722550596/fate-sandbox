import type {
  LocationState,
  SceneThreatSeverity,
  SituationKind,
  StoryWindowState,
} from "../../engine/core/state";

import { updateScene, type SceneEvent } from "../../engine/core/scene";
import { assertNonNegativeInteger } from "../../engine/core/state";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";
import { assertOneOfString } from "./domain-assert";

const SCENE_EVENT_KINDS = [
  "advance-time",
  "move-location",
  "set-location",
  "set-situation",
  "set-story-window",
  "clear-story-window",
  "add-objective",
  "resolve-objective",
  "add-threat",
  "clear-threat",
] as const;

const SITUATIONS = [
  "daily",
  "investigation",
  "social",
  "combat",
  "ritual",
  "escape",
  "downtime",
] as const satisfies readonly SituationKind[];

const BOUNDARIES = ["normal", "bounded-field", "reality-marble", "otherworld"] as const satisfies readonly LocationState["boundary"][];
const THREAT_SEVERITIES = ["low", "medium", "high", "lethal"] as const satisfies readonly SceneThreatSeverity[];

export function updateSceneTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => updateScene(assertSceneEvent(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function assertSceneEvent(params: unknown): SceneEvent {
  const input = assertRecord(params, "update_scene 参数");
  const kind = assertOneOfString(input["kind"], SCENE_EVENT_KINDS, "update_scene.kind");
  const reason = assertString(input["reason"], "reason");

  switch (kind) {
    case "advance-time":
      return {
        kind,
        elapsedMinutes: assertNonNegativeInteger(input["elapsedMinutes"], "elapsedMinutes"),
        reason,
      };
    case "move-location":
      return {
        kind,
        location: normalizeLocation(input["location"]),
        elapsedMinutes: assertNonNegativeInteger(input["elapsedMinutes"], "elapsedMinutes"),
        reason,
      };
    case "set-location":
      return { kind, location: normalizeLocation(input["location"]), reason };
    case "set-situation":
      return {
        kind,
        situation: assertOneOfString(input["situation"], SITUATIONS, "situation"),
        reason,
      };
    case "set-story-window":
      return { kind, storyWindow: trustStoryWindow(input["storyWindow"]), reason };
    case "clear-story-window":
      return { kind, reason };
    case "add-objective":
      return { kind, summary: assertString(input["summary"], "summary"), reason };
    case "resolve-objective":
      return {
        kind,
        objectiveId: normalizeOptionalString(input["objectiveId"]),
        objectiveSummary: normalizeOptionalString(input["objectiveSummary"]),
        reason,
      };
    case "add-threat":
      return {
        kind,
        summary: assertString(input["summary"], "summary"),
        severity: assertOneOfString(input["severity"], THREAT_SEVERITIES, "severity"),
        reason,
      };
    case "clear-threat":
      return { kind, threatId: assertString(input["threatId"], "threatId"), reason };
  }
}

function normalizeLocation(value: unknown): LocationState {
  const location = assertRecord(value, "location");
  return {
    region: assertString(location["region"], "location.region"),
    site: assertString(location["site"], "location.site"),
    detail: assertString(location["detail"], "location.detail"),
    boundary: assertOneOfString(location["boundary"], BOUNDARIES, "location.boundary"),
  };
}

function trustStoryWindow(value: unknown): StoryWindowState {
  assertRecord(value, "storyWindow");
  return value as StoryWindowState; // safe: scene engine/state schema validates full storyWindow before mutation.
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
