import type { PublicGameState } from "../state/state.ts";

import { formatHookLedger } from "../hooks/hooks.ts";
import { recentPlayerKnownRelationshipSignals } from "../relationship-signal.ts";
import { formatHumanTime } from "../state/date-time.ts";

export function buildGmBrief(publicState: PublicGameState): string {
  const protagonist = publicState.actors[publicState.protagonistActorId];
  if (protagonist === undefined) {
    throw new Error(`GM brief failed: protagonist ${publicState.protagonistActorId} missing.`);
  }
  const time = formatHumanTime(publicState.clock.currentAt, publicState.clock.timezone);
  return [
    "[当前 GM 简报]",
    `时间：${time.display}`,
    `地点：${formatPublicLocation(publicState.scene.location, { includeBoundary: true })}`,
    `态势：${publicState.scene.situation}`,
    `剧情窗口：${formatStoryWindow(publicState)}`,
    `玩家角色：${formatActorLine(protagonist)}`,
    `同行者：${formatAllies(publicState)}`,
    `资源：${formatGmBriefFunds(publicState)}`,
    `状态效果：${formatCondition(protagonist.condition)}`,
    `当前目标：${formatActiveObjectives(publicState, { separator: "；" })}`,
    `目标推进规则：${formatObjectiveRouting(publicState)}`,
    `当前威胁：${formatSceneThreats(publicState, { separator: "；", colon: ":" })}`,
    `威胁清除规则：${formatThreatRouting(publicState)}`,
    ...formatOpenObligationLines(publicState),
    ...formatHookLedgerLines(publicState),
    `最近关系信号：${formatRecentRelationshipSignals(publicState)}`,
    `最近重大记忆：${formatRecentEvents(publicState)}`,
    "本轮工具纪律：每轮 time 必须用 elapsed/travel 推进时间；Scene Beat lifecycle 用 progress_scene_beat；非 Scene Beat lifecycle 的多状态变化用 commit_turn；actor 入场/离场用 set_scene_presence。不要输出 JSON、数值表、schema 字段。",
  ].join("\n");
}

function formatHookLedgerLines(publicState: PublicGameState): string[] {
  const ledger = formatHookLedger(publicState.hooks);
  return ledger === undefined ? [] : [ledger];
}

function formatOpenObligationLines(publicState: PublicGameState): string[] {
  if (publicState.obligations.length === 0) return [];
  const entries = publicState.obligations
    .map((entry) => `[${entry.kind}] ${entry.summary}`)
    .join("；");
  return [`⚠ 未清裁决义务（canonical commit 前必须落地）：${entries}`];
}

export function buildStatusMarkdown(publicState: PublicGameState): string {
  return [
    "## 当前状态",
    "",
    `- 时间：${publicState.clock.currentAt}（${publicState.clock.timezone}）`,
    `- 地点：${formatPublicLocation(publicState.scene.location)}`,
    `- 场景：${publicState.scene.situation}`,
    `- 在场：${formatPresentActors(publicState)}`,
    `- 目标：${formatActiveObjectives(publicState, { separator: "；" })}`,
    `- 威胁：${formatSceneThreats(publicState, { separator: "；", colon: ": " })}`,
    "",
    buildInventoryMarkdown(publicState),
  ].join("\n");
}

export function buildInventoryMarkdown(publicState: PublicGameState): string {
  return [
    "## 资源与物品",
    "",
    "### 资金",
    "",
    formatFunds(publicState),
    "",
    "### 关键物品",
    "",
    formatTrackedItems(publicState),
    "",
    "### 普通随身物",
    "",
    formatOrdinaryItems(publicState),
  ].join("\n");
}

function formatPublicLocation(
  location: PublicGameState["scene"]["location"],
  options: { includeBoundary?: boolean } = {},
): string {
  const base = [location.region, location.site, location.detail]
    .filter((part) => part.length > 0)
    .join(" · ");
  if (!options.includeBoundary || location.boundary === "normal") {
    return base;
  }
  return `${base}（${location.boundary}）`;
}

function formatActiveObjectives(
  publicState: PublicGameState,
  options: { separator: string },
): string {
  const active = publicState.scene.objectives.filter(
    (objective) => objective.status !== "resolved",
  );
  return active.length === 0
    ? "无"
    : active.map((objective) => `${objective.id}: ${objective.summary}`).join(options.separator);
}

function formatObjectiveRouting(publicState: PublicGameState): string {
  const activeObjectives = publicState.scene.objectives.filter(
    (objective) => objective.status !== "resolved",
  );
  if (publicState.scene.storyWindow === null) {
    return "当前没有 active Scene Beat；objectives 是 beat-scoped 状态，不能用 commit_turn 增删。复杂新场景先用 progress_scene_beat kind=begin；普通状态变化用 commit_turn。";
  }
  if (activeObjectives.length === 0) {
    return "当前 beat 的目标已全部解决；用 progress_scene_beat kind=complete 收口。";
  }
  return "active beat 收口用 progress_scene_beat complete；仅在局部解决非最终目标时，commit_turn 的 scene event 用 resolve-objective 并用 objectiveSummary 逐字复制上方 summary（不能解决最后一个目标）。";
}

function formatSceneThreats(
  publicState: PublicGameState,
  options: { separator: string; colon: string },
): string {
  return publicState.scene.threats.length === 0
    ? "无"
    : publicState.scene.threats
        .map((threat) => `${threat.id} [${threat.severity}]${options.colon}${threat.summary}`)
        .join(options.separator);
}

function formatThreatRouting(publicState: PublicGameState): string {
  if (publicState.scene.threats.length === 0) {
    return "当前没有可清除的威胁；不要使用 clear-threat。";
  }
  return "用 commit_turn 局部清除威胁时，scene event 用 clear-threat，并用 threatSummary 逐字复制上方威胁的 summary（或用上方方括号前的 threatId）。";
}

function formatStoryWindow(publicState: PublicGameState): string {
  const window = publicState.scene.storyWindow;
  if (window === null) {
    return "未设定；复杂场景应先用 progress_scene_beat kind=begin 锁定 beat 边界";
  }
  const allowed = window.allowedActions.length === 0 ? "未列出" : window.allowedActions.join("、");
  const forbidden =
    window.forbiddenEscalations.length === 0 ? "未列出" : window.forbiddenEscalations.join("、");
  const criteria =
    window.completionCriteria.length === 0 ? "未列出" : window.completionCriteria.join("、");
  return `${window.currentArcId}/${window.currentBeatId}《${window.title}》；允许：${allowed}；禁区：${forbidden}；完成：${criteria}`;
}

function formatActorLine(actor: NonNullable<PublicGameState["actors"][string]>): string {
  const identity = formatIdentity(actor);
  const sequence = formatSequence(actor);
  return [actor.presentation.renderName, actor.kind, identity, sequence].join(" / ");
}

function formatIdentity(actor: NonNullable<PublicGameState["actors"][string]>): string {
  const memoryIdentity = actor.identity.lockedFacts.find((fact) => fact.id === "setup-identity");
  return memoryIdentity?.text ?? actor.identity.publicIdentity;
}

function formatSequence(actor: NonNullable<PublicGameState["actors"][string]>): string {
  const seq = actor.sequence;
  if (seq === null) {
    return "无序列";
  }
  return [
    seq.currentSequence,
    `途径${seq.pathway}`,
    `神性${seq.divinity}`,
    `消化${seq.digestionProgress}%`,
    `失控${seq.lossOfControlProgress}%`,
  ].join("；");
}

function formatAllies(publicState: PublicGameState): string {
  if (publicState.allyActorIds.length === 0) {
    return "无";
  }
  return publicState.allyActorIds
    .map((actorId) => publicState.actors[actorId])
    .filter((actor) => actor !== undefined)
    .map(
      (actor) => `${actor.presentation.renderName}（${actor.relationshipToProtagonist.summary}）`,
    )
    .join("；");
}

function formatGmBriefFunds(publicState: PublicGameState): string {
  const total = publicState.economy.accessibleFunds.reduce((sum, purse) => sum + purse.amount, 0);
  const keyItems = Object.values(publicState.trackedItems)
    .filter((item) => item.visibility === "player-known")
    .map((item) => item.label)
    .slice(0, 5);
  const itemText = keyItems.length === 0 ? "无关键物品" : `关键物品：${keyItems.join("、")}`;
  return `可访问资金 ${total.toLocaleString()} 便士；${itemText}`;
}

function formatCondition(
  condition: NonNullable<PublicGameState["actors"][string]>["condition"],
): string {
  const lines = condition.afflictions.map((effect) => `${effect.source}:${effect.text}`);
  return lines.length === 0 ? "无显著状态效果" : lines.join("；");
}

function formatRecentEvents(publicState: PublicGameState): string {
  const recent = publicState.memory.eventLog.slice(-3);
  return recent.length === 0
    ? "无"
    : recent.map((event) => `${event.title}：${event.summary}`).join("；");
}

function formatRecentRelationshipSignals(publicState: PublicGameState): string {
  const recent = recentPlayerKnownRelationshipSignals(publicState, 4);
  return recent.length === 0
    ? "无"
    : recent
        .map(
          (signal) =>
            `${publicState.actors[signal.actorId]?.presentation.renderName ?? signal.actorId}→${publicState.actors[signal.targetActorId]?.presentation.renderName ?? signal.targetActorId}：${signal.signal}（边界：${signal.boundary}）`,
        )
        .join("；");
}

function formatPresentActors(publicState: PublicGameState): string {
  const names = publicState.scene.presentActorIds.map(
    (actorId) => publicState.actors[actorId]?.presentation.renderName ?? actorId,
  );
  return names.length === 0 ? "无" : names.join("、");
}

function formatFunds(publicState: PublicGameState): string {
  if (publicState.economy.accessibleFunds.length === 0) {
    return "- 无可访问资金";
  }
  return publicState.economy.accessibleFunds
    .map((purse) => {
      const owner =
        purse.ownerActorId === publicState.protagonistActorId
          ? "你"
          : (publicState.actors[purse.ownerActorId]?.presentation.renderName ?? purse.ownerActorId);
      const accessTag =
        purse.access === "held" ? "随身持有" : purse.access === "shared" ? "共享" : "需许可";
      return `- ${purse.label}（${owner} · ${accessTag}）：${purse.amount.toLocaleString()} ${publicState.economy.currency}`;
    })
    .join("\n");
}

function formatTrackedItems(publicState: PublicGameState): string {
  const items = Object.values(publicState.trackedItems)
    .filter((item) => item.visibility === "player-known")
    .toSorted((left, right) => left.label.localeCompare(right.label));
  if (items.length === 0) {
    return "- 无关键物品";
  }
  return items
    .map((item) => {
      const holder =
        item.holderActorId === null
          ? "未随身持有"
          : (publicState.actors[item.holderActorId]?.presentation.renderName ?? item.holderActorId);
      const notes = item.notes.length === 0 ? "" : `；${item.notes.join("；")}`;
      return `- ${item.label}（${holder}；${item.condition}${notes}）`;
    })
    .join("\n");
}

function formatOrdinaryItems(publicState: PublicGameState): string {
  const lines = Object.values(publicState.actors)
    .filter((actor) => actor.inventory.items.length > 0)
    .map((actor) => `- ${actor.presentation.renderName}：${actor.inventory.items.join("、")}`);
  return lines.length === 0 ? "- 无记录" : lines.join("\n");
}
