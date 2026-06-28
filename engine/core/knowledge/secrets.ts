import type {
  ActorId,
  ActorSecretSlots,
  HiddenWorldFact,
  OffscreenEvent,
  SecretSlot,
  State,
} from "../state/state.ts";
import type {
  ConfigureActorSecretsInput,
  ConfigureSequenceSecretsInput,
  PrivateResolveEvent,
  RevealSecretEvent,
  SecretStringInput,
} from "./secrets-schema.ts";

import { getActorSecretSlots, setActorSecretSlots } from "../actor/secret-actor-state.ts";
import { settleOldestObligation } from "../ledger/obligations.ts";
import { createId } from "../utils/ids.ts";
import { assertNonEmptyString } from "../utils/typebox-validation.ts";
import { recordMemory } from "./memory.ts";

export type {
  AddHiddenWorldFactInput,
  ConfigureActorSecretsInput,
  ConfigureSequenceSecretsInput,
  PrivateResolveEvent,
  RevealSecretEvent,
  RevealSecretToolInput,
  SecretStringInput,
} from "./secrets-schema.ts";

export interface ConfigureSequenceSecretsResult {
  message: string;
}

export interface ConfigureActorSecretsResult {
  message: string;
}

export interface ConfigureHiddenWorldFactResult {
  message: string;
}

export type RevealSecretOutcome =
  | "revealed"
  | "foreshadowed"
  | "insufficient-evidence"
  | "incorrect";

export interface RevealSecretResult {
  outcome: RevealSecretOutcome;
  playerSafeMessage: string;
}

export function configureSequenceSecrets(
  draft: State,
  input: ConfigureSequenceSecretsInput,
): ConfigureSequenceSecretsResult {
  assertNonEmptyString(input.reason, "reason");
  assertNonEmptyString(input.actorId, "actorId");
  if (input.beyonderSecrets === undefined || input.beyonderSecrets.length === 0) {
    throw new Error("configure-sequence-secrets 必须提供 beyonderSecrets。");
  }

  const actor = draft.public.actors[input.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${input.actorId}`);
  }
  if (actor.sequence === null) {
    throw new Error(`actor 没有序列: ${input.actorId}`);
  }

  const existing =
    getActorSecretSlots(draft.secrets, input.actorId) ?? createEmptyActorSecretSlots(input.actorId);
  if (input.beyonderSecrets !== undefined) {
    for (const secret of input.beyonderSecrets) {
      const slotId = `${input.actorId}-${secret.kind}`;
      const existingIndex = existing.beyonderSecrets.findIndex((s) => s.id === slotId);
      const newSlot = buildStringSecretSlot(
        existingIndex >= 0 ? existing.beyonderSecrets[existingIndex] : undefined,
        slotId,
        {
          value: secret.value,
          revealConditions: secret.revealConditions,
        },
      );
      if (existingIndex >= 0) {
        existing.beyonderSecrets[existingIndex] = newSlot;
      } else {
        existing.beyonderSecrets.push(newSlot);
      }
    }
  }
  setActorSecretSlots(draft.secrets, input.actorId, existing);

  return { message: `序列 secrets 已配置：${input.actorId}。` };
}

export function configureActorSecrets(
  draft: State,
  input: ConfigureActorSecretsInput,
): ConfigureActorSecretsResult {
  assertNonEmptyString(input.reason, "reason");
  assertNonEmptyString(input.actorId, "actorId");
  if (
    (input.privateMotives?.length ?? 0) === 0 &&
    (input.unrevealedAffiliations?.length ?? 0) === 0
  ) {
    throw new Error("configure-actor-secrets 必须提供 privateMotives 或 unrevealedAffiliations。");
  }

  const actor = draft.public.actors[input.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${input.actorId}`);
  }

  const existing =
    getActorSecretSlots(draft.secrets, input.actorId) ?? createEmptyActorSecretSlots(input.actorId);
  appendStringSecretSlots(
    existing.privateMotives,
    input.actorId,
    "motive",
    input.privateMotives ?? [],
  );
  appendStringSecretSlots(
    existing.unrevealedAffiliations,
    input.actorId,
    "affiliation",
    input.unrevealedAffiliations ?? [],
  );
  setActorSecretSlots(draft.secrets, input.actorId, existing);

  return { message: `actor secrets 已配置：${input.actorId}。` };
}

export function configureHiddenWorldFact(
  draft: State,
  input: import("./secrets-schema.ts").AddHiddenWorldFactInput,
): ConfigureHiddenWorldFactResult {
  assertNonEmptyString(input.text, "text");
  assertNonEmptyString(input.reason, "reason");

  const existing = draft.secrets.hiddenWorldFacts.find((fact) => fact.text === input.text);
  if (existing !== undefined) {
    existing.revealConditions = mergeRevealConditions(
      existing.revealConditions,
      input.revealConditions,
    );
    if (input.relatedActorIds.length > 0) {
      existing.relatedActorIds = input.relatedActorIds;
    }
    return { message: `世界事实已更新：${input.text}` };
  }

  draft.secrets.hiddenWorldFacts.push({
    id: createId(draft, "world-fact"),
    text: input.text,
    relatedActorIds: input.relatedActorIds,
    revealConditions: [
      ...new Set(input.revealConditions.map((c: string) => c.trim()).filter(Boolean)),
    ],
    revealState: "hidden",
  });
  return { message: `世界事实已记录：${input.text}` };
}

export function revealSecret(draft: State, event: RevealSecretEvent): RevealSecretResult {
  const evidence = event.kind === "claim-reveal" ? event.evidence : event.evidence;
  assertNonEmptyString(evidence, "evidence");
  if (event.kind === "claim-reveal") {
    assertNonEmptyString(event.claim, "claim");
  } else {
    assertNonEmptyString(event.trigger, "trigger");
  }

  const result = applyRevealSecret(draft, event, evidence);

  if (result.outcome === "revealed") {
    settleOldestObligation(draft, ["reveal-secret"]);
    recordMemory(draft, {
      kind: "record-major-event",
      title: "隐藏事实揭示",
      summary: result.playerSafeMessage,
      consequences: ["相关公开状态已更新。"],
      claims: [
        {
          kind: "world-fact",
          statement: result.playerSafeMessage,
          certainty: "confirmed",
          evidence: "reveal_secret 已验证玩家证据并更新公开状态。",
        },
      ],
    });
  }

  return result;
}

function tryRevealWorldFact(fact: HiddenWorldFact, event: RevealSecretEvent): boolean {
  if (fact.revealState === "revealed") return false;
  const needle = event.kind === "claim-reveal" ? event.claim : event.trigger;
  const evidence = revealEvidenceText(event);
  const normalizedNeedle = needle.toLowerCase();
  const normalizedEvidence = evidence.toLowerCase();
  const textMatch = fact.text.toLowerCase().includes(normalizedNeedle);
  const evidenceMatch = fact.revealConditions.some((c) =>
    normalizedEvidence.includes(c.toLowerCase()),
  );
  return textMatch && evidenceMatch;
}

function markWorldFactForeshadowed(draft: State, evidence: string): boolean {
  let marked = false;
  for (const fact of draft.secrets.hiddenWorldFacts) {
    if (fact.revealState !== "hidden") continue;
    if (fact.revealConditions.some((c) => evidence.toLowerCase().includes(c.toLowerCase()))) {
      fact.revealState = "foreshadowed";
      marked = true;
    }
  }
  return marked;
}

function applyRevealSecret(
  draft: State,
  event: RevealSecretEvent,
  evidence: string,
): RevealSecretResult {
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${event.actorId}`);
  }
  const slots = getActorSecretSlots(draft.secrets, event.actorId);
  if (slots !== undefined) {
    for (const secret of slots.beyonderSecrets) {
      if (canRevealStringSlot(event, secret)) {
        secret.revealState = "revealed";
        return { outcome: "revealed", playerSafeMessage: "非凡者秘密已经揭示。" };
      }
    }
    if (markForeshadowed(slots, evidence)) {
      return { outcome: "foreshadowed", playerSafeMessage: "线索成立，但尚不足以完全揭示。" };
    }
  }
  // 扫描隐藏世界事实
  const protagonistId = draft.public.protagonistActorId;
  for (const fact of draft.secrets.hiddenWorldFacts) {
    const actorMatches =
      fact.relatedActorIds.length === 0
        ? event.actorId === protagonistId
        : fact.relatedActorIds.includes(event.actorId);
    if (!actorMatches) continue;
    if (tryRevealWorldFact(fact, event)) {
      fact.revealState = "revealed";
      return {
        outcome: "revealed",
        playerSafeMessage: "世界隐藏事实已经揭示。",
      };
    }
  }

  if (markWorldFactForeshadowed(draft, evidence)) {
    return {
      outcome: "foreshadowed",
      playerSafeMessage: "线索成立，但尚不足以完全揭示。",
    };
  }

  return {
    outcome: "insufficient-evidence",
    playerSafeMessage: "证据不足，暂不能确认隐藏事实。",
  };
}

function createEmptyActorSecretSlots(actorId: ActorId): ActorSecretSlots {
  return {
    actorId,
    beyonderSecrets: [],
    privateMotives: [],
    unrevealedAffiliations: [],
  };
}

function buildStringSecretSlot(
  existing: SecretSlot<string> | undefined,
  id: string,
  input: SecretStringInput,
): SecretSlot<string> {
  return {
    id: existing?.id ?? id,
    value: assertNonEmptyString(input.value, "secret.value"),
    revealState: existing?.revealState ?? "hidden",
    revealConditions: mergeRevealConditions(
      existing?.revealConditions ?? [],
      input.revealConditions,
    ),
  };
}

function appendStringSecretSlots(
  slots: Array<SecretSlot<string>>,
  actorId: ActorId,
  slotKind: string,
  inputs: SecretStringInput[],
): void {
  for (const input of inputs) {
    const value = assertNonEmptyString(input.value, "secret.value");
    const existingIndex = slots.findIndex((slot) => slot.value === value);
    const existing = existingIndex === -1 ? undefined : slots[existingIndex];
    const slot = buildStringSecretSlot(
      existing,
      `${actorId}-${slotKind}-${slugifySecretIdPart(value)}`,
      input,
    );
    if (existingIndex === -1) {
      slots.push(slot);
    } else {
      slots[existingIndex] = slot;
    }
  }
}

function mergeRevealConditions(existing: string[], incoming: string[]): string[] {
  const merged: string[] = [];
  for (const condition of [...existing, ...incoming]) {
    const normalized = assertNonEmptyString(condition, "revealCondition");
    if (!merged.includes(normalized)) {
      merged.push(normalized);
    }
  }
  return merged;
}

function slugifySecretIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function canRevealStringSlot(event: RevealSecretEvent, slot: SecretSlot<string>): boolean {
  if (slot.revealState === "revealed") return false;
  const needle = event.kind === "claim-reveal" ? event.claim : event.trigger;
  return slotMatches(slot, needle) && evidenceMatches(slot, revealEvidenceText(event));
}

function revealEvidenceText(event: RevealSecretEvent): string {
  const needle = event.kind === "claim-reveal" ? event.claim : event.trigger;
  return `${needle}\n${event.evidence}`;
}

function slotMatches<T>(slot: SecretSlot<T>, text: string): boolean {
  const needle = text.toLowerCase();
  const serialized = String(slot.value).toLowerCase();
  return needle.includes(serialized);
}
function evidenceMatches<T>(slot: SecretSlot<T>, evidence: string): boolean {
  const normalized = evidence.toLowerCase();
  return slot.revealConditions.some((condition) => normalized.includes(condition.toLowerCase()));
}

function markForeshadowed(slots: ActorSecretSlots, evidence: string): boolean {
  let marked = false;
  const allStringSlots: Array<SecretSlot<string>> = [
    ...slots.beyonderSecrets,
    ...slots.privateMotives,
    ...slots.unrevealedAffiliations,
  ];
  for (const slot of allStringSlots) {
    if (slot.revealState === "hidden" && evidenceMatches(slot, evidence)) {
      slot.revealState = "foreshadowed";
      marked = true;
    }
  }
  return marked;
}

export interface PrivateResolveResult {
  outcome: "no-special-effect" | "subtle-reaction" | "strong-reaction" | "dangerous-escalation";
  narrativeConstraints: string[];
}

export function privateResolve(draft: State, event: PrivateResolveEvent): PrivateResolveResult {
  return event.kind === "hidden-reaction"
    ? hiddenReaction(draft, event)
    : secretCompatibility(draft, event);
}

export function getOffscreenEventsForDebug(state: State): readonly OffscreenEvent[] {
  return state.secrets.offscreenEventLog;
}

function hiddenReaction(
  draft: State,
  event: Extract<PrivateResolveEvent, { kind: "hidden-reaction" }>,
): PrivateResolveResult {
  assertNonEmptyString(event.stimulus, "stimulus");
  assertNonEmptyString(event.publicContext, "publicContext");
  if (draft.public.actors[event.actorId] === undefined) {
    throw new Error(`actor 不存在: ${event.actorId}`);
  }
  const slots = getActorSecretSlots(draft.secrets, event.actorId);
  const hasRelevantSecret =
    slots !== undefined && secretText(slots).includes(event.stimulus.toLowerCase());

  return {
    outcome: hasRelevantSecret ? "subtle-reaction" : "no-special-effect",
    narrativeConstraints: hasRelevantSecret
      ? ["可以描写可见的细微反应，但不得泄露隐藏真相。"]
      : ["没有特殊隐藏反应；不要暗示不存在的秘密。"],
  };
}

function secretCompatibility(
  draft: State,
  event: Extract<PrivateResolveEvent, { kind: "secret-compatibility" }>,
): PrivateResolveResult {
  assertNonEmptyString(event.interaction, "interaction");
  if (draft.public.actors[event.actorId] === undefined) {
    throw new Error(`actor 不存在: ${event.actorId}`);
  }
  if (draft.public.actors[event.targetActorId] === undefined) {
    throw new Error(`target actor 不存在: ${event.targetActorId}`);
  }
  const bothHaveSecrets =
    getActorSecretSlots(draft.secrets, event.actorId) !== undefined &&
    getActorSecretSlots(draft.secrets, event.targetActorId) !== undefined;
  return {
    outcome: bothHaveSecrets ? "strong-reaction" : "no-special-effect",
    narrativeConstraints: bothHaveSecrets
      ? ["互动存在隐藏相性；只输出玩家可见约束，不解释幕后原因。"]
      : ["没有隐藏相性介入。"],
  };
}

function secretText(slots: ActorSecretSlots): string {
  return JSON.stringify(slots).toLowerCase();
}
