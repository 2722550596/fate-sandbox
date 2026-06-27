import type {
  ActorAgendaState,
  ActorId,
  ActorKnowledgeLens,
  ActorSecretSlots,
  SecretActorState,
  SecretGameState,
} from "../state/state.ts";

/**
 * Secret Game State 里 per-actor 隐藏状态的唯一访问 seam。
 *
 * 存储是 `secrets.actorStates: Record<ActorId, SecretActorState>`——一个 actor 的
 * 秘密(secrets) / 主动性(agenda) / 认知边界(knowledgeLens) 收在同一个 bundle。
 * 所有领域代码都通过这里读写,绝不裸触 actorStates,这样:
 *   1. 空 bundle 修剪逻辑只活在一处(清掉最后一个 facet 时自动删 bundle);
 *   2. 三个 facet 的同生共死由级联出口 deleteSecretActorState 保证;
 *   3. 未来新增 per-actor 秘密 facet = SecretActorState 加字段 + 这里加访问器,
 *      不再是新的顶层侧表 + 新迁移 + 新级联点 + 新 invariant。
 */

function bundleFor(secrets: SecretGameState, actorId: ActorId): SecretActorState {
  const existing = secrets.actorStates[actorId];
  if (existing !== undefined) {
    return existing;
  }
  const fresh: SecretActorState = { actorId };
  secrets.actorStates[actorId] = fresh;
  return fresh;
}

function pruneIfEmpty(secrets: SecretGameState, actorId: ActorId): void {
  const bundle = secrets.actorStates[actorId];
  if (bundle === undefined) {
    return;
  }
  if (
    bundle.secrets === undefined &&
    bundle.agenda === undefined &&
    bundle.knowledgeLens === undefined
  ) {
    delete secrets.actorStates[actorId];
  }
}

// ─── secrets（公开/秘密防火墙的核心 slot 结构）────────────────────

export function getActorSecretSlots(
  secrets: SecretGameState,
  actorId: ActorId,
): ActorSecretSlots | undefined {
  return secrets.actorStates[actorId]?.secrets;
}

export function setActorSecretSlots(
  secrets: SecretGameState,
  actorId: ActorId,
  slots: ActorSecretSlots,
): void {
  bundleFor(secrets, actorId).secrets = slots;
}

export function allActorSecretSlots(secrets: SecretGameState): ActorSecretSlots[] {
  const out: ActorSecretSlots[] = [];
  for (const bundle of Object.values(secrets.actorStates)) {
    if (bundle.secrets !== undefined) {
      out.push(bundle.secrets);
    }
  }
  return out;
}

// ─── agenda（NPC 主动性账本）────────────────────────────────────

export function getActorAgenda(
  secrets: SecretGameState,
  actorId: ActorId,
): ActorAgendaState | undefined {
  return secrets.actorStates[actorId]?.agenda;
}

export function setActorAgenda(
  secrets: SecretGameState,
  actorId: ActorId,
  agenda: ActorAgendaState,
): void {
  bundleFor(secrets, actorId).agenda = agenda;
}

export function deleteActorAgenda(secrets: SecretGameState, actorId: ActorId): void {
  const bundle = secrets.actorStates[actorId];
  if (bundle === undefined) {
    return;
  }
  delete bundle.agenda;
  pruneIfEmpty(secrets, actorId);
}

export function allActorAgendas(secrets: SecretGameState): ActorAgendaState[] {
  const out: ActorAgendaState[] = [];
  for (const bundle of Object.values(secrets.actorStates)) {
    if (bundle.agenda !== undefined) {
      out.push(bundle.agenda);
    }
  }
  return out;
}

// ─── knowledgeLens（NPC 认知边界账本）──────────────────────────

export function getActorKnowledgeLens(
  secrets: SecretGameState,
  actorId: ActorId,
): ActorKnowledgeLens | undefined {
  return secrets.actorStates[actorId]?.knowledgeLens;
}

export function setActorKnowledgeLens(
  secrets: SecretGameState,
  actorId: ActorId,
  lens: ActorKnowledgeLens,
): void {
  bundleFor(secrets, actorId).knowledgeLens = lens;
}

export function deleteActorKnowledgeLens(secrets: SecretGameState, actorId: ActorId): void {
  const bundle = secrets.actorStates[actorId];
  if (bundle === undefined) {
    return;
  }
  delete bundle.knowledgeLens;
  pruneIfEmpty(secrets, actorId);
}

// ─── 级联出口（actor 退场）──────────────────────────────────────

/** 抹除一个 actor 的全部隐藏状态。仅供 removeActorEverywhere 调用。 */
export function deleteSecretActorState(secrets: SecretGameState, actorId: ActorId): void {
  delete secrets.actorStates[actorId];
}
