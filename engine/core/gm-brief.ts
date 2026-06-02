import type { PublicGameState } from "./state";

import { formatHumanTime } from "./date-time";

export function buildGmBrief(publicState: PublicGameState): string {
  const protagonist = publicState.actors[publicState.protagonistActorId];
  if (protagonist === undefined) {
    throw new Error(`GM brief failed: protagonist ${publicState.protagonistActorId} missing.`);
  }
  const time = formatHumanTime(publicState.clock.currentAt);
  return [
    "[当前 GM 简报]",
    `时间：${time.display}`,
    `地点：${formatLocation(publicState.scene.location)}`,
    `态势：${publicState.scene.situation}`,
    `剧情窗口：${formatStoryWindow(publicState)}`,
    `玩家角色：${formatActorLine(protagonist)}`,
    `同行者：${formatAllies(publicState)}`,
    `资源：${formatFunds(publicState)}`,
    `伤势/长期影响：${formatCondition(protagonist.condition)}`,
    `当前目标：${formatObjectives(publicState)}`,
    `当前威胁：${formatThreats(publicState)}`,
    `最近重大记忆：${formatRecentEvents(publicState)}`,
    "本轮工具纪律：复杂 beat 开始用 start_scene_beat；当前 beat 收口用 finish_current_beat；非常规多状态组合才用 commit_turn；actor 入场/离场用 set_scene_presence。不要输出 JSON、数值表、schema 字段。",
  ].join("\n");
}

function formatLocation(location: PublicGameState["scene"]["location"]): string {
  const boundary = location.boundary === "normal" ? "" : `（${location.boundary}）`;
  return `${location.region} · ${location.site} · ${location.detail}${boundary}`;
}

function formatStoryWindow(publicState: PublicGameState): string {
  const window = publicState.scene.storyWindow;
  if (window === null) {
    return "未设定；复杂场景应先用 start_scene_beat 锁定 beat 边界";
  }
  const allowed = window.allowedActions.length === 0 ? "未列出" : window.allowedActions.join("、");
  const forbidden =
    window.forbiddenEscalations.length === 0 ? "未列出" : window.forbiddenEscalations.join("、");
  const criteria =
    window.completionCriteria.length === 0 ? "未列出" : window.completionCriteria.join("、");
  return `${window.currentArcId}/${window.currentBeatId}《${window.title}》；允许：${allowed}；禁区：${forbidden}；完成：${criteria}`;
}

function formatActorLine(actor: NonNullable<PublicGameState["actors"][string]>): string {
  const servant = actor.servantForm;
  const identity = formatIdentity(actor);
  if (servant === null) {
    return `${actor.presentation.displayName} / ${actor.kind} / ${identity}`;
  }
  return [
    actor.presentation.displayName,
    actor.kind,
    servant.identity.className,
    `真名${servant.identity.trueName.status}:${servant.identity.trueName.display}`,
    `灵基${resourceBand(servant.condition.spiritualCore.value)}`,
    `魔力${resourceBand(servant.condition.mana.value)}`,
    `契约${servant.contract.status}`,
  ].join(" / ");
}

function formatIdentity(actor: NonNullable<PublicGameState["actors"][string]>): string {
  const memoryIdentity = actor.identity.lockedFacts.find((fact) => fact.id === "setup-identity");
  return memoryIdentity?.text ?? actor.identity.publicIdentity;
}

function formatAllies(publicState: PublicGameState): string {
  if (publicState.allyActorIds.length === 0) {
    return "无";
  }
  return publicState.allyActorIds
    .map((actorId) => publicState.actors[actorId])
    .filter((actor) => actor !== undefined)
    .map(
      (actor) => `${actor.presentation.displayName}（${actor.relationshipToProtagonist.summary}）`,
    )
    .join("；");
}

function formatFunds(publicState: PublicGameState): string {
  const total = publicState.economy.accessibleFunds.reduce((sum, purse) => sum + purse.amount, 0);
  const keyItems = Object.values(publicState.trackedItems)
    .filter((item) => item.visibility === "player-known")
    .map((item) => item.label)
    .slice(0, 5);
  const itemText = keyItems.length === 0 ? "无关键物品" : `关键物品：${keyItems.join("、")}`;
  return `可访问资金 ${total.toLocaleString()} 円；${itemText}`;
}

function formatCondition(
  condition: NonNullable<PublicGameState["actors"][string]>["condition"],
): string {
  const wounds = condition.wounds.map((wound) => `${wound.severity}:${wound.text}`);
  const afflictions = condition.afflictions.map((affliction) => affliction.text);
  const effects = condition.permanentEffects.map((effect) => effect.text);
  const all = [...wounds, ...afflictions, ...effects];
  return all.length === 0 ? "无显著伤势或长期影响" : all.join("；");
}

function formatObjectives(publicState: PublicGameState): string {
  const active = publicState.scene.objectives.filter(
    (objective) => objective.status !== "resolved",
  );
  return active.length === 0 ? "无" : active.map((objective) => objective.summary).join("；");
}

function formatThreats(publicState: PublicGameState): string {
  return publicState.scene.threats.length === 0
    ? "无"
    : publicState.scene.threats.map((threat) => `${threat.severity}:${threat.summary}`).join("；");
}

function formatRecentEvents(publicState: PublicGameState): string {
  const recent = publicState.memory.eventLog.slice(-3);
  return recent.length === 0
    ? "无"
    : recent.map((event) => `${event.title}：${event.summary}`).join("；");
}

function resourceBand(value: number): string {
  if (value >= 80) return "稳定";
  if (value >= 50) return "尚可";
  if (value >= 25) return "低落";
  if (value > 0) return "危险";
  return "枯竭";
}
