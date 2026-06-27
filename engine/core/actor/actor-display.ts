import type { ActorId, PublicGameState } from "../state/state.ts";

/**
 * Public Game State Projection 的玩家安全显示名解析。
 * 所有面向玩家的读模型（GM Brief、状态面板、印象卡、关系信号）都用这一处：
 * 有 actor 用其 renderName，缺失则回退到 actorId，绝不暴露 internalName。
 */
export function actorDisplayName(publicState: PublicGameState, actorId: ActorId): string {
  const actor = publicState.actors[actorId];
  return actor === undefined ? actorId : actor.presentation.renderName;
}
