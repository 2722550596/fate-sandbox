import type { MemoryClaim, MemoryEvent } from "../../engine/core/memory";
import type { SceneBeatInput } from "../../engine/core/scene";
import type { ActorId, SituationKind, StoryBeatId, StoryWindowState } from "../../engine/core/state";
import type { TurnCommitEvent, TurnCommitInput } from "../../engine/core/turn-commit";

import { commitTurn } from "../../engine/core/turn-commit";
import { getState, writeStateToDetails } from "../../engine/core/state";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { textResult, type ToolResult } from "../runtime/tool-result";

interface FinishCurrentBeatInput {
  outcome: string;
  memory?: FinishBeatMemoryInput;
  nextBeat?: FinishBeatNextBeatInput | null;
  presentActorIds?: ActorId[];
  allyActorIds?: ActorId[];
  situation?: SituationKind;
}

interface FinishBeatMemoryInput {
  title: string;
  summary: string;
  consequences?: string[];
  claims: MemoryClaim[];
}

interface FinishBeatNextBeatInput {
  title: string;
  objectives: string[];
  beatId?: StoryBeatId;
  allowedActions?: string[];
  forbiddenEscalations?: string[];
  completionCriteria?: string[];
  nextBeatHints?: string[];
  presentActorIds?: ActorId[];
  allyActorIds?: ActorId[];
  situation?: SituationKind;
}

const DEFAULT_ALLOWED_ACTIONS = ["观察当前局势", "回应在场角色", "决定下一步行动"];

export function finishCurrentBeatTool(params: unknown, sessionManager: unknown): ToolResult {
  const input = normalizeFinishCurrentBeatInput(params);
  const turnInput = buildTurnCommitInput(input);
  const result = commitTurn(turnInput);
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
}

function buildTurnCommitInput(input: FinishCurrentBeatInput): TurnCommitInput {
  const state = getState();
  const currentWindow = state.public.scene.storyWindow;
  if (currentWindow === null) {
    throw new Error("finish_current_beat 需要当前存在 storyWindow；若只是记录普通状态变化，请用 commit_turn。");
  }

  const nextBeat = buildNextBeatInput(input, currentWindow);
  const events: TurnCommitEvent[] = [
    {
      kind: "scene-beat",
      event: {
        kind: "transition-beat",
        input: {
          completedBeatId: currentWindow.currentBeatId,
          resolveAllObjectives: true,
          nextBeat,
          reason: input.outcome,
        },
      },
    },
  ];

  if (input.memory !== undefined) {
    events.push({ kind: "memory", event: buildMemoryEvent(input.memory) });
  }

  if (nextBeat === null) {
    if (input.presentActorIds !== undefined || input.allyActorIds !== undefined) {
      events.push({
        kind: "scene-presence",
        event: {
          presentActorIds: input.presentActorIds ?? state.public.scene.presentActorIds,
          allyActorIds: input.allyActorIds ?? state.public.allyActorIds,
          reason: input.outcome,
        },
      });
    }
    if (input.situation !== undefined) {
      events.push({
        kind: "scene",
        event: { kind: "set-situation", situation: input.situation, reason: input.outcome },
      });
    }
  }

  return { summary: input.outcome, events };
}

function buildNextBeatInput(
  input: FinishCurrentBeatInput,
  currentWindow: StoryWindowState,
): SceneBeatInput | null {
  if (input.nextBeat === undefined || input.nextBeat === null) {
    return null;
  }
  return {
    storyWindow: {
      currentArcId: currentWindow.currentArcId,
      currentBeatId: input.nextBeat.beatId ?? `${currentWindow.currentBeatId}-next`,
      title: input.nextBeat.title,
      allowedActions: input.nextBeat.allowedActions ?? DEFAULT_ALLOWED_ACTIONS,
      forbiddenEscalations: input.nextBeat.forbiddenEscalations ?? [],
      completionCriteria: input.nextBeat.completionCriteria ?? input.nextBeat.objectives,
      nextBeatHints: input.nextBeat.nextBeatHints ?? [],
    },
    objectives: input.nextBeat.objectives,
    presentActorIds: input.nextBeat.presentActorIds ?? input.presentActorIds,
    allyActorIds: input.nextBeat.allyActorIds ?? input.allyActorIds,
    situation: input.nextBeat.situation ?? input.situation,
    reason: input.outcome,
  };
}

function buildMemoryEvent(input: FinishBeatMemoryInput): MemoryEvent {
  return {
    kind: "record-major-event",
    title: input.title,
    summary: input.summary,
    consequences: input.consequences,
    claims: input.claims,
  };
}

function normalizeFinishCurrentBeatInput(params: unknown): FinishCurrentBeatInput {
  const input = assertRecord(params, "finish_current_beat 参数");
  return {
    outcome: assertNonEmptyString(input["outcome"], "outcome"),
    memory: normalizeOptionalMemory(input["memory"]),
    nextBeat: normalizeOptionalNextBeat(input["nextBeat"]),
    presentActorIds: normalizeOptionalStringArray(input["presentActorIds"], "presentActorIds"),
    allyActorIds: normalizeOptionalStringArray(input["allyActorIds"], "allyActorIds"),
    situation: normalizeOptionalString(input["situation"], "situation") as SituationKind | undefined,
  };
}

function normalizeOptionalMemory(value: unknown): FinishBeatMemoryInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  const input = assertRecord(value, "memory");
  return {
    title: assertNonEmptyString(input["title"], "memory.title"),
    summary: assertNonEmptyString(input["summary"], "memory.summary"),
    consequences: normalizeOptionalStringArray(input["consequences"], "memory.consequences"),
    claims: normalizeClaims(input["claims"]),
  };
}

function normalizeOptionalNextBeat(value: unknown): FinishBeatNextBeatInput | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const input = assertRecord(value, "nextBeat");
  return {
    title: assertNonEmptyString(input["title"], "nextBeat.title"),
    objectives: normalizeStringArray(input["objectives"], "nextBeat.objectives"),
    beatId: normalizeOptionalString(input["beatId"], "nextBeat.beatId"),
    allowedActions: normalizeOptionalStringArray(input["allowedActions"], "nextBeat.allowedActions"),
    forbiddenEscalations: normalizeOptionalStringArray(
      input["forbiddenEscalations"],
      "nextBeat.forbiddenEscalations",
    ),
    completionCriteria: normalizeOptionalStringArray(
      input["completionCriteria"],
      "nextBeat.completionCriteria",
    ),
    nextBeatHints: normalizeOptionalStringArray(input["nextBeatHints"], "nextBeat.nextBeatHints"),
    presentActorIds: normalizeOptionalStringArray(input["presentActorIds"], "nextBeat.presentActorIds"),
    allyActorIds: normalizeOptionalStringArray(input["allyActorIds"], "nextBeat.allyActorIds"),
    situation: normalizeOptionalString(input["situation"], "nextBeat.situation") as
      | SituationKind
      | undefined,
  };
}

function normalizeClaims(value: unknown): MemoryClaim[] {
  return assertArray(value, "memory.claims").map((entry) => {
    const claim = assertRecord(entry, "memory.claims[]");
    return {
      kind: assertNonEmptyString(claim["kind"], "claim.kind") as MemoryClaim["kind"],
      statement: assertNonEmptyString(claim["statement"], "claim.statement"),
      certainty: assertNonEmptyString(claim["certainty"], "claim.certainty") as MemoryClaim["certainty"],
      subjectId: normalizeOptionalString(claim["subjectId"], "claim.subjectId"),
      relatedSecretSlotIds: normalizeOptionalStringArray(
        claim["relatedSecretSlotIds"],
        "claim.relatedSecretSlotIds",
      ),
      evidence: normalizeOptionalString(claim["evidence"], "claim.evidence"),
    };
  });
}

function normalizeOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return normalizeStringArray(value, fieldName);
}

function normalizeStringArray(value: unknown, fieldName: string): string[] {
  return assertArray(value, fieldName).map((entry) => assertNonEmptyString(entry, `${fieldName}[]`));
}

function normalizeOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertNonEmptyString(value, fieldName);
}

function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`非法${fieldName}: 必须是非空字符串。`);
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
