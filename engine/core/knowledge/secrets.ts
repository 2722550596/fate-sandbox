import type {
  ActorId,
  ActorSecretSlots,
  HiddenWorldFact,
  OffscreenEvent,
  SecretSlot,
  State,
} from "../state/state.ts";
import type {
  ConfigureSecretInput,
  PrivateResolveEvent,
  RevealSecretEvent,
  SecretStringInput,
} from "./secrets-schema.ts";
import type { SecretCandidate } from "./semantic-reveal.ts";

import { getActorSecretSlots, setActorSecretSlots } from "../actor/secret-actor-state.ts";
import { createId } from "../utils/ids.ts";
import { assertNonEmptyString } from "../utils/typebox-validation.ts";
import { judgeSecrets } from "./semantic-reveal.ts";
export type {
  ConfigureSecretInput,
  PrivateResolveEvent,
  RevealSecretEvent,
  SecretStringInput,
} from "./secrets-schema.ts";

// ===========================================================================
// Result interfaces
// ===========================================================================

export interface ConfigureSecretResult {
  message: string;
}

export type RevealSecretOutcome =
  | "revealed"
  | "foreshadowed"
  | "insufficient-evidence"
  | "incorrect";

export interface RevealSecretResult {
  outcome: RevealSecretOutcome;
  narrativeConstraints: string[];
}

// ===========================================================================
// Internal helpers
// ===========================================================================

function recordSecretEvent(draft: State, summary: string, relatedActorIds: string[] = []): void {
  draft.secrets.secretEventLog.push({
    id: createId(draft, "secret-event"),
    time: draft.public.clock.currentAt,
    summary,
    relatedActorIds: [...new Set(relatedActorIds)],
  });
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

function createEmptyActorSecretSlots(actorId: ActorId): ActorSecretSlots {
  return {
    actorId,
    beyonderSecrets: [],
    privateMotives: [],
    unrevealedAffiliations: [],
  };
}

function revealEvidenceText(event: RevealSecretEvent): string {
  const needle = event.kind === "claim-reveal" ? event.claim : event.trigger;
  return `${needle}\n${event.evidence}`;
}

function secretText(slots: ActorSecretSlots): string {
  return JSON.stringify(slots).toLowerCase();
}

// ===========================================================================
// configureSecret — 配置隐藏秘密
// ===========================================================================

export function configureSecret(draft: State, input: ConfigureSecretInput): ConfigureSecretResult {
  switch (input.kind) {
    case "actor-beyonder":
      return configureActorBeyonderSecrets(draft, input);
    case "actor-private":
      return configureActorPrivateSecrets(draft, input);
    case "world-fact":
      return configureWorldFact(draft, input);
    default:
      // Exhaustive check — all variants handled above
      return input satisfies never;
  }
}

function configureActorBeyonderSecrets(
  draft: State,
  input: ConfigureSecretInput & { kind: "actor-beyonder" },
): ConfigureSecretResult {
  assertNonEmptyString(input.actorId, "actorId");
  assertNonEmptyString(input.reason, "reason");
  if (draft.public.actors[input.actorId] === undefined) {
    throw new Error(`configure_secret: actor 不存在: ${input.actorId}`);
  }

  const existing =
    getActorSecretSlots(draft.secrets, input.actorId) ?? createEmptyActorSecretSlots(input.actorId);
  appendStringSecretSlots(existing.beyonderSecrets, input.actorId, "beyonder", input.secrets);
  setActorSecretSlots(draft.secrets, input.actorId, existing);
  recordSecretEvent(draft, `${input.actorId} 的非凡者秘密已配置`, [input.actorId]);

  return { message: `非凡者秘密已配置：${input.actorId}。` };
}

function configureActorPrivateSecrets(
  draft: State,
  input: ConfigureSecretInput & { kind: "actor-private" },
): ConfigureSecretResult {
  assertNonEmptyString(input.actorId, "actorId");
  assertNonEmptyString(input.reason, "reason");
  if (draft.public.actors[input.actorId] === undefined) {
    throw new Error(`configure_secret: actor 不存在: ${input.actorId}`);
  }

  const existing =
    getActorSecretSlots(draft.secrets, input.actorId) ?? createEmptyActorSecretSlots(input.actorId);
  appendStringSecretSlots(existing.privateMotives, input.actorId, "motive", input.secrets);
  setActorSecretSlots(draft.secrets, input.actorId, existing);
  recordSecretEvent(draft, `${input.actorId} 的隐藏动机/归属已配置`, [input.actorId]);

  return { message: `actor secrets 已配置：${input.actorId}。` };
}

function configureWorldFact(
  draft: State,
  input: ConfigureSecretInput & { kind: "world-fact" },
): ConfigureSecretResult {
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

// ===========================================================================
// revealSecret — 纯揭示
// ===========================================================================

export async function revealSecret(
  draft: State,
  event: RevealSecretEvent,
): Promise<RevealSecretResult> {
  assertNonEmptyString(event.actorId, "actorId");
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`reveal_secret: actor 不存在: ${event.actorId}`);
  }

  const evidence = revealEvidenceText(event);
  const needle = event.kind === "claim-reveal" ? event.claim : event.trigger;

  // 收集所有候选秘密
  const candidates: SecretCandidate[] = [];
  const slotLookup = new Map<string, SecretSlot<string>>();
  const factLookup = new Map<string, HiddenWorldFact>();

  const slots = getActorSecretSlots(draft.secrets, event.actorId);
  if (slots !== undefined) {
    for (const s of slots.beyonderSecrets) {
      if (s.revealState !== "revealed") {
        candidates.push({
          id: s.id,
          kind: "actor-beyonder",
          value: s.value,
          conditions: s.revealConditions,
        });
        slotLookup.set(s.id, s);
      }
    }
    for (const s of slots.privateMotives) {
      if (s.revealState !== "revealed") {
        candidates.push({
          id: s.id,
          kind: "actor-private",
          value: s.value,
          conditions: s.revealConditions,
        });
        slotLookup.set(s.id, s);
      }
    }
    for (const s of slots.unrevealedAffiliations) {
      if (s.revealState !== "revealed") {
        candidates.push({
          id: s.id,
          kind: "actor-private",
          value: s.value,
          conditions: s.revealConditions,
        });
        slotLookup.set(s.id, s);
      }
    }
  }

  for (const fact of draft.secrets.hiddenWorldFacts) {
    if (fact.revealState !== "revealed") {
      candidates.push({
        id: fact.id,
        kind: "world-fact",
        value: fact.text,
        conditions: fact.revealConditions,
      });
      factLookup.set(fact.id, fact);
    }
  }

  if (candidates.length === 0) {
    return {
      outcome: "insufficient-evidence",
      narrativeConstraints: ["所有已知秘密已被揭示，无可揭示内容"],
    };
  }

  // 推理判断（两阶段：子串快速通道 + LLM 推理通道）
  const judgments = await judgeSecrets({ kind: event.kind, needle, evidence }, candidates);

  // 应用判断结果
  let revealed = false;
  let foreshadowed = false;

  for (const j of judgments) {
    const fact = factLookup.get(j.id);
    if (fact !== undefined) {
      if (j.needleMatch && j.evidenceMatch) {
        fact.revealState = "revealed";
        revealed = true;
      } else if (!j.needleMatch && j.evidenceMatch && fact.revealState === "hidden") {
        fact.revealState = "foreshadowed";
        foreshadowed = true;
      }
      continue;
    }

    const slot = slotLookup.get(j.id);
    if (slot !== undefined) {
      if (j.needleMatch && j.evidenceMatch) {
        slot.revealState = "revealed";
        revealed = true;
      } else if (!j.needleMatch && j.evidenceMatch && slot.revealState === "hidden") {
        slot.revealState = "foreshadowed";
        foreshadowed = true;
      }
    }
  }

  if (revealed) {
    recordSecretEvent(draft, `${event.actorId} 的秘密被揭示`, [event.actorId]);
    return {
      outcome: "revealed",
      narrativeConstraints: ["该事实已从 hidden-canonical 转为 public，渲染器可正常使用"],
    };
  }

  if (foreshadowed) {
    return {
      outcome: "foreshadowed",
      narrativeConstraints: ["线索成立，但尚不足以完全揭示。渲染器可用预感/梦境/异象等方式暗示"],
    };
  }

  return {
    outcome: "insufficient-evidence",
    narrativeConstraints: ["证据不足以触发现有隐藏事实；继续收集线索后再试"],
  };
}

// ===========================================================================
// privateResolve — 窄口私密结算
// ===========================================================================

export interface PrivateResolveResult {
  outcome: "no-special-effect" | "subtle-reaction" | "strong-reaction" | "dangerous-escalation";
  narrativeConstraints: string[];
}

export function privateResolve(draft: State, event: PrivateResolveEvent): PrivateResolveResult {
  return event.kind === "hidden-reaction"
    ? hiddenReaction(draft, event)
    : secretCompatibility(draft, event);
}

function hiddenReaction(
  draft: State,
  event: Extract<PrivateResolveEvent, { kind: "hidden-reaction" }>,
): PrivateResolveResult {
  assertNonEmptyString(event.stimulus, "stimulus");
  assertNonEmptyString(event.actorId, "actorId");
  const slots = getActorSecretSlots(draft.secrets, event.actorId);
  const hasRelevantSecret =
    slots !== undefined && secretText(slots).includes(event.stimulus.toLowerCase());

  if (!hasRelevantSecret) {
    return {
      outcome: "no-special-effect",
      narrativeConstraints: ["NPC 反应无异常。渲染器正常叙事即可。"],
    };
  }
  const secretCount = [
    ...slots.beyonderSecrets,
    ...slots.privateMotives,
    ...slots.unrevealedAffiliations,
  ].filter((s) => s.revealState !== "revealed").length;

  if (secretCount > 3) {
    return {
      outcome: "dangerous-escalation",
      narrativeConstraints: [
        `NPC 隐藏秘密被刺激触及。渲染器用「对方神色骤变/突然沉默/试图转移话题」来表现。`,
        "不允许直接描写隐藏秘密的具体内容。",
      ],
    };
  }
  if (secretCount > 1) {
    return {
      outcome: "strong-reaction",
      narrativeConstraints: [
        `NPC 有明显的隐藏反应。渲染器用「眼神闪烁/停顿片刻/语气变得谨慎」来表现。`,
        "不允许直接描写隐藏秘密的具体内容。",
      ],
    };
  }
  return {
    outcome: "subtle-reaction",
    narrativeConstraints: [
      `NPC 有细微的隐藏反应。渲染器用「不易察觉的停顿/指尖微动」来表现。`,
      "不允许直接描写隐藏秘密的具体内容。",
    ],
  };
}

function secretCompatibility(
  draft: State,
  event: Extract<PrivateResolveEvent, { kind: "secret-compatibility" }>,
): PrivateResolveResult {
  assertNonEmptyString(event.actorId, "actorId");
  assertNonEmptyString(event.targetActorId, "targetActorId");

  const slotsA = getActorSecretSlots(draft.secrets, event.actorId);
  const slotsB = getActorSecretSlots(draft.secrets, event.targetActorId);

  if (slotsA === undefined || slotsB === undefined) {
    return {
      outcome: "no-special-effect",
      narrativeConstraints: ["两方之间无隐藏相性影响。"],
    };
  }

  const aText = secretText(slotsA);
  const bText = secretText(slotsB);
  const interaction = event.interaction.toLowerCase();
  const hasSharedSecret = aText.includes(interaction) && bText.includes(interaction);

  if (!hasSharedSecret) {
    return {
      outcome: "no-special-effect",
      narrativeConstraints: ["两方之间无隐藏相性影响。"],
    };
  }

  return {
    outcome: "subtle-reaction",
    narrativeConstraints: [
      "双方有潜在的隐藏相性（共享秘密或关联）。渲染器用「若有所察/气氛微妙」来表现。",
      "不允许直接描写隐藏秘密的具体内容。",
    ],
  };
}

// ===========================================================================
// Debug helpers
// ===========================================================================

export function getOffscreenEventsForDebug(state: State): readonly OffscreenEvent[] {
  return state.secrets.offscreenEventLog;
}
