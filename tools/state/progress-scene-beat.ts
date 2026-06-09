import type { MemoryClaim } from "../../engine/core/memory";
import type {
  SceneBeatActionPolicy,
  SceneBeatMemoryInput,
  SceneBeatNextBeatInput,
  SceneBeatPresenceInput,
  SceneBeatProgressInput,
} from "../../engine/core/scene-beat-lifecycle";
import type { SceneBeatThreatInput } from "../../engine/core/scene";
import type { SituationKind } from "../../engine/core/state";

import { progressSceneBeat } from "../../engine/core/scene-beat-lifecycle";
import { parseTurnTimePolicySchema } from "../../engine/core/turn-time-schema";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";
import {
  assertArray,
  assertOneOf,
  assertRecord,
  assertString,
  assertStringArray,
  normalizeOptionalString,
  normalizeOptionalStringArray,
} from "./tool-input";

const SITUATIONS = [
  "daily",
  "investigation",
  "social",
  "combat",
  "ritual",
  "escape",
  "downtime",
] as const satisfies readonly SituationKind[];
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
const PROGRESS_SCENE_BEAT_KINDS = ["begin", "complete"] as const satisfies readonly SceneBeatProgressInput["kind"][];

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
  const kind = assertOneOf(input["kind"], "progress_scene_beat.kind", PROGRESS_SCENE_BEAT_KINDS);
  return kind === "begin" ? normalizeBeginSceneBeatInput(input) : normalizeCompleteSceneBeatInput(input);
}

function normalizeBeginSceneBeatInput(
  input: Record<string, unknown>,
): Extract<SceneBeatProgressInput, { kind: "begin" }> {
  return {
    kind: "begin",
    title: assertString(input["title"], "title"),
    objectives: assertStringArray(input["objectives"], "objectives"),
    purpose: assertString(input["purpose"], "purpose"),
    time: parseTurnTimePolicySchema(input["time"], "time"),
    beatId: normalizeOptionalString(input["beatId"], "beatId"),
    actionPolicy: normalizeOptionalActionPolicy(input["actionPolicy"]),
    threats: normalizeOptionalThreats(input["threats"]),
    presence: normalizeOptionalPresence(input["presence"]),
    situation: normalizeOptionalSituation(input["situation"], "situation"),
  };
}

function normalizeCompleteSceneBeatInput(
  input: Record<string, unknown>,
): Extract<SceneBeatProgressInput, { kind: "complete" }> {
  return {
    kind: "complete",
    outcome: assertString(input["outcome"], "outcome"),
    time: parseTurnTimePolicySchema(input["time"], "time"),
    memory: normalizeOptionalMemory(input["memory"]),
    nextBeat: normalizeOptionalNextBeat(input["nextBeat"]),
    presence: normalizeOptionalPresence(input["presence"]),
    situation: normalizeOptionalSituation(input["situation"], "situation"),
  };
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
    objectives: assertStringArray(input["objectives"], "nextBeat.objectives"),
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

function normalizeOptionalSituation(value: unknown, fieldName: string): SituationKind | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertOneOf(value, fieldName, SITUATIONS);
}
