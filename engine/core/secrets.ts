import type {
  ConfigureActorSecretsInput,
  ConfigureServantSecretsInput,
  PrivateResolveEvent,
  RevealSecretEvent,
  ServantSecretNoblePhantasmInput,
  ServantSecretStringInput,
} from "./secrets-schema.ts";
import type {
  ActorId,
  ActorSecretSlots,
  NoblePhantasm,
  OffscreenEvent,
  SecretSlot,
  State,
} from "./state.ts";

import { recordMemory } from "./memory.ts";
import { settleOldestObligation } from "./obligations.ts";
import { recordOffscreenEvent } from "./offscreen-event.ts";
import { inferOffscreenPressureType } from "./offscreen-pressure.ts";
import { getActorSecretSlots, setActorSecretSlots } from "./secret-actor-state.ts";
import { assertNonEmptyString } from "./typebox-validation.ts";

export type {
  ConfigureActorSecretsInput,
  ConfigureServantSecretsInput,
  PrivateResolveEvent,
  RevealSecretEvent,
  RevealSecretToolInput,
  ServantSecretNoblePhantasmInput,
  ServantSecretStringInput,
} from "./secrets-schema.ts";

export interface ConfigureServantSecretsResult {
  message: string;
}

export interface ConfigureActorSecretsResult {
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

export function configureServantSecrets(
  draft: State,
  input: ConfigureServantSecretsInput,
): ConfigureServantSecretsResult {
  assertNonEmptyString(input.reason, "reason");
  assertNonEmptyString(input.actorId, "actorId");
  if (input.trueName === undefined && (input.hiddenNoblePhantasms?.length ?? 0) === 0) {
    throw new Error("configure-servant-secrets 必须提供 trueName 或 hiddenNoblePhantasms。");
  }

  const actor = draft.public.actors[input.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${input.actorId}`);
  }
  if (actor.servantForm === null) {
    throw new Error(`actor 不是从者: ${input.actorId}`);
  }

  const existing =
    getActorSecretSlots(draft.secrets, input.actorId) ?? createEmptyActorSecretSlots(input.actorId);
  if (input.trueName !== undefined) {
    existing.trueName = buildStringSecretSlot(
      existing.trueName,
      `${input.actorId}-true-name`,
      input.trueName,
    );
  }
  for (const noblePhantasm of input.hiddenNoblePhantasms ?? []) {
    upsertNoblePhantasmSecretSlot(existing.hiddenNoblePhantasms, input.actorId, noblePhantasm);
  }
  setActorSecretSlots(draft.secrets, input.actorId, existing);

  return { message: `从者 secrets 已配置：${input.actorId}。` };
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
  if (slots === undefined) {
    return { outcome: "insufficient-evidence", playerSafeMessage: "没有足够证据确认。" };
  }
  const trueName = slots.trueName;
  if (trueName !== undefined && canRevealStringSlot(event, trueName)) {
    trueName.revealState = "revealed";
    if (actor.servantForm !== null) {
      actor.servantForm.identity.trueName = { status: "revealed", display: trueName.value };
    }
    return { outcome: "revealed", playerSafeMessage: "真名揭示已经成立。" };
  }
  const noblePhantasm = slots.hiddenNoblePhantasms.find((slot) =>
    canRevealNoblePhantasmSlot(event, slot),
  );
  if (noblePhantasm !== undefined && actor.servantForm !== null) {
    noblePhantasm.revealState = "revealed";
    const revealedEntry = { ...noblePhantasm.value, status: "revealed" as const };
    const hiddenIndex = findReplaceableHiddenNoblePhantasmIndex(
      actor.servantForm.noblePhantasms,
      noblePhantasm.value.name,
    );
    if (hiddenIndex === -1) {
      actor.servantForm.noblePhantasms.push(revealedEntry);
    } else {
      actor.servantForm.noblePhantasms[hiddenIndex] = revealedEntry;
    }
    return { outcome: "revealed", playerSafeMessage: "隐藏宝具信息已经揭示。" };
  }
  if (markForeshadowed(slots, evidence)) {
    return { outcome: "foreshadowed", playerSafeMessage: "线索成立，但尚不足以完全揭示。" };
  }
  return {
    outcome: "insufficient-evidence",
    playerSafeMessage: "证据不足，暂不能确认隐藏事实。",
  };
}

function createEmptyActorSecretSlots(actorId: ActorId): ActorSecretSlots {
  return {
    actorId,
    hiddenNoblePhantasms: [],
    privateMotives: [],
    unrevealedAffiliations: [],
  };
}

function findReplaceableHiddenNoblePhantasmIndex(
  noblePhantasms: NoblePhantasm[],
  revealedName: string,
): number {
  const hiddenNoblePhantasms = noblePhantasms
    .map((noblePhantasm, index) => ({ noblePhantasm, index }))
    .filter(({ noblePhantasm }) => noblePhantasm.status === "hidden");
  if (hiddenNoblePhantasms.length === 0) {
    return -1;
  }
  const nameMatch = hiddenNoblePhantasms.find(
    ({ noblePhantasm }) =>
      noblePhantasm.name === revealedName ||
      noblePhantasm.name.includes(revealedName) ||
      revealedName.includes(noblePhantasm.name),
  );
  if (nameMatch !== undefined) {
    return nameMatch.index;
  }
  const first = hiddenNoblePhantasms[0];
  if (first === undefined) {
    return -1;
  }
  return first.index;
}

function buildStringSecretSlot(
  existing: SecretSlot<string> | undefined,
  id: string,
  input: ServantSecretStringInput,
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
  inputs: ServantSecretStringInput[],
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

function upsertNoblePhantasmSecretSlot(
  slots: Array<SecretSlot<NoblePhantasm>>,
  actorId: ActorId,
  input: ServantSecretNoblePhantasmInput,
): void {
  const name = assertNonEmptyString(input.value.name, "noblePhantasm.name");
  const existingIndex = slots.findIndex((slot) => slot.value.name === name);
  const existing = existingIndex === -1 ? undefined : slots[existingIndex];
  const slot: SecretSlot<NoblePhantasm> = {
    id: existing?.id ?? `${actorId}-np-${slugifySecretIdPart(name)}`,
    value: input.value,
    revealState: existing?.revealState ?? "hidden",
    revealConditions: mergeRevealConditions(
      existing?.revealConditions ?? [],
      input.revealConditions,
    ),
  };
  if (existingIndex === -1) {
    slots.push(slot);
  } else {
    slots[existingIndex] = slot;
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

function canRevealNoblePhantasmSlot(
  event: RevealSecretEvent,
  slot: SecretSlot<NoblePhantasm>,
): boolean {
  if (slot.revealState === "revealed") return false;
  const needle = event.kind === "claim-reveal" ? event.claim : event.trigger;
  return slotMatches(slot, needle) && evidenceMatches(slot, revealEvidenceText(event));
}

function revealEvidenceText(event: RevealSecretEvent): string {
  const needle = event.kind === "claim-reveal" ? event.claim : event.trigger;
  return `${needle}\n${event.evidence}`;
}

function slotMatches<T>(slot: SecretSlot<T>, text: string): boolean {
  const normalized = text.toLowerCase();
  const serialized = JSON.stringify(slot.value).toLowerCase();
  return (
    serialized.includes(normalized) ||
    slot.revealConditions.some((condition) => normalized.includes(condition.toLowerCase()))
  );
}

function evidenceMatches<T>(slot: SecretSlot<T>, evidence: string): boolean {
  const normalized = evidence.toLowerCase();
  return slot.revealConditions.some((condition) => normalized.includes(condition.toLowerCase()));
}

function markForeshadowed(slots: ActorSecretSlots, evidence: string): boolean {
  let marked = false;
  const allStringSlots: Array<SecretSlot<string>> = [
    ...(slots.trueName === undefined ? [] : [slots.trueName]),
    ...slots.privateMotives,
    ...slots.unrevealedAffiliations,
  ];
  const allNoblePhantasmSlots: Array<SecretSlot<NoblePhantasm>> = [...slots.hiddenNoblePhantasms];
  for (const slot of allStringSlots) {
    if (slot.revealState === "hidden" && evidenceMatches(slot, evidence)) {
      slot.revealState = "foreshadowed";
      marked = true;
    }
  }
  for (const slot of allNoblePhantasmSlots) {
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
  if (hasRelevantSecret) {
    recordOffscreenEvent(draft, {
      lineId: "private-resolve",
      actorIds: [event.actorId],
      timeRange: { start: draft.public.clock.currentAt, end: draft.public.clock.currentAt },
      visibility: "secret",
      summary: `隐藏反应触发：${event.publicContext}`,
      consequences: [],
      futureHooks: [],
      createdFrom: "gm",
      pressureType: inferOffscreenPressureType([event.actorId], event.publicContext),
      pressureSlotId: null,
    });
  }
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
