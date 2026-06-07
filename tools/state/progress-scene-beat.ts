import type { MemoryClaim } from "../../engine/core/memory";
import type {
  SceneBeatActionPolicy,
  SceneBeatLocationMoveInput,
  SceneBeatMemoryInput,
  SceneBeatNextBeatInput,
  SceneBeatPresenceInput,
  SceneBeatProgressInput,
} from "../../engine/core/scene-beat-lifecycle";
import type { SceneBeatThreatInput } from "../../engine/core/scene";
import type { LocationState, SituationKind } from "../../engine/core/state";

import { progressSceneBeat } from "../../engine/core/scene-beat-lifecycle";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";

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
const THREAT_SEVERITIES = ["low", "medium", "high", "lethal"] as const satisfies readonly SceneBeatThreatInput["severity"][];
const MEMORY_CLAIM_KINDS = [
  "mundane",
  "identity",
  "location",
  "affiliation",
  "motive",
  "ability",
  "resource",
  "relationship",
  "event-cause",
  "world-fact",
] as const satisfies readonly MemoryClaim["kind"][];
const MEMORY_CERTAINTIES = [
  "observed",
  "confirmed",
  "inferred",
  "rumor",
  "hypothesis",
] as const satisfies readonly MemoryClaim["certainty"][];

export function progressSceneBeatTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => progressSceneBeat(normalizeSceneBeatProgressInput(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function normalizeSceneBeatProgressInput(params: unknown): SceneBeatProgressInput {
  const input = assertRecord(params, "progress_scene_beat 参数");
  const kind = assertString(input["kind"], "kind");
  switch (kind) {
    case "begin":
      return {
        kind,
        title: assertString(input["title"], "title"),
        objectives: normalizeStringArray(input["objectives"], "objectives"),
        purpose: assertString(input["purpose"], "purpose"),
        beatId: normalizeOptionalString(input["beatId"], "beatId"),
        actionPolicy: normalizeOptionalActionPolicy(input["actionPolicy"]),
        threats: normalizeOptionalThreats(input["threats"]),
        presence: normalizeOptionalPresence(input["presence"]),
        situation: normalizeOptionalSituation(input["situation"], "situation"),
        locationMove: normalizeOptionalLocationMove(input["locationMove"]),
      };
    case "complete":
      return {
        kind,
        outcome: assertString(input["outcome"], "outcome"),
        memory: normalizeOptionalMemory(input["memory"]),
        nextBeat: normalizeOptionalNextBeat(input["nextBeat"]),
        presence: normalizeOptionalPresence(input["presence"]),
        situation: normalizeOptionalSituation(input["situation"], "situation"),
      };
    default:
      throw new Error("非法 progress_scene_beat.kind: 必须是 begin 或 complete。");
  }
}

function normalizeOptionalActionPolicy(value: unknown): SceneBeatActionPolicy | undefined {
  if (value === undefined) {
    return undefined;
  }
  const input = assertRecord(value, "actionPolicy");
  return {
    allowedActions: normalizeOptionalStringArray(input["allowedActions"], "actionPolicy.allowedActions"),
    forbiddenEscalations: normalizeOptionalStringArray(
      input["forbiddenEscalations"],
      "actionPolicy.forbiddenEscalations",
    ),
    completionCriteria: normalizeOptionalStringArray(
      input["completionCriteria"],
      "actionPolicy.completionCriteria",
    ),
    nextBeatHints: normalizeOptionalStringArray(input["nextBeatHints"], "actionPolicy.nextBeatHints"),
  };
}

function normalizeOptionalThreats(value: unknown): SceneBeatThreatInput[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertArray(value, "threats").map((entry) => {
    const threat = assertRecord(entry, "threats[]");
    return {
      summary: assertString(threat["summary"], "threat.summary"),
      severity: assertOneOf(threat["severity"], "threat.severity", THREAT_SEVERITIES),
    };
  });
}

function normalizeOptionalPresence(value: unknown): SceneBeatPresenceInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  const input = assertRecord(value, "presence");
  return {
    presentActorIds: normalizeOptionalStringArray(input["presentActorIds"], "presence.presentActorIds"),
    allyActorIds: normalizeOptionalStringArray(input["allyActorIds"], "presence.allyActorIds"),
  };
}

function normalizeOptionalLocationMove(value: unknown): SceneBeatLocationMoveInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  const input = assertRecord(value, "locationMove");
  return {
    location: normalizeLocation(input["location"]),
    elapsedMinutes: normalizePositiveInteger(input["elapsedMinutes"], "locationMove.elapsedMinutes"),
  };
}

function normalizeOptionalMemory(value: unknown): SceneBeatMemoryInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  const input = assertRecord(value, "memory");
  return {
    title: assertString(input["title"], "memory.title"),
    summary: assertString(input["summary"], "memory.summary"),
    consequences: normalizeOptionalStringArray(input["consequences"], "memory.consequences"),
    claims: normalizeClaims(input["claims"]),
  };
}

function normalizeOptionalNextBeat(value: unknown): SceneBeatNextBeatInput | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  const input = assertRecord(value, "nextBeat");
  return {
    title: assertString(input["title"], "nextBeat.title"),
    objectives: normalizeStringArray(input["objectives"], "nextBeat.objectives"),
    beatId: normalizeOptionalString(input["beatId"], "nextBeat.beatId"),
    actionPolicy: normalizeOptionalActionPolicy(input["actionPolicy"]),
    threats: normalizeOptionalThreats(input["threats"]),
    presence: normalizeOptionalPresence(input["presence"]),
    situation: normalizeOptionalSituation(input["situation"], "nextBeat.situation"),
  };
}

function normalizeClaims(value: unknown): MemoryClaim[] {
  return assertArray(value, "memory.claims").map((entry, index) => {
    const claim = assertRecord(entry, `memory.claims[${index}]`);
    return {
      kind: assertOneOf(claim["kind"], `memory.claims[${index}].kind`, MEMORY_CLAIM_KINDS),
      statement: assertString(claim["statement"], `memory.claims[${index}].statement`),
      certainty: assertOneOf(
        claim["certainty"],
        `memory.claims[${index}].certainty`,
        MEMORY_CERTAINTIES,
      ),
      subjectId: normalizeOptionalString(claim["subjectId"], `memory.claims[${index}].subjectId`),
      relatedSecretSlotIds: normalizeOptionalStringArray(
        claim["relatedSecretSlotIds"],
        `memory.claims[${index}].relatedSecretSlotIds`,
      ),
      evidence: normalizeOptionalString(claim["evidence"], `memory.claims[${index}].evidence`),
    };
  });
}

function normalizeLocation(value: unknown): LocationState {
  const location = assertRecord(value, "locationMove.location");
  return {
    region: assertString(location["region"], "location.region"),
    site: assertString(location["site"], "location.site"),
    detail: assertString(location["detail"], "location.detail"),
    boundary: assertOneOf(location["boundary"], "location.boundary", BOUNDARIES),
  };
}

function normalizeOptionalSituation(value: unknown, fieldName: string): SituationKind | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertOneOf(value, fieldName, SITUATIONS);
}

function normalizeOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return normalizeStringArray(value, fieldName);
}

function normalizeStringArray(value: unknown, fieldName: string): string[] {
  return assertArray(value, fieldName).map((entry, index) => assertString(entry, `${fieldName}[${index}]`));
}

function normalizeOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertString(value, fieldName);
}

function normalizePositiveInteger(value: unknown, fieldName: string): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} 必须是大于 0 的整数。`);
  }
  return parsed;
}

function assertOneOf<T extends string>(value: unknown, fieldName: string, allowed: readonly T[]): T {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} 必须是字符串。允许值: ${allowed.join(", ")}。`);
  }
  for (const candidate of allowed) {
    if (value === candidate) {
      return candidate;
    }
  }
  throw new Error(`非法 ${fieldName}: ${value}。允许值: ${allowed.join(", ")}。`);
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
