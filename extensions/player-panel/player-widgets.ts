/**
 * 玩家侧小件投影（backlog #10）。
 *
 * 纯 player-safe：只从 PublicGameState 投影，不泄露 secrets。
 * 每个函数返回 Markdown 字符串，由 player-panel 扩展渲染。
 */

import type { PublicGameState } from "../../engine/core/state/state.ts";

import { recentPlayerKnownRelationshipSignals } from "../../engine/core/relationship-signal.ts";
import { formatHumanTime } from "../../engine/core/state/date-time.ts";

// ─── /relations ──────────────────────────────────────────────────

// 外观三件套：表观年龄 / 衣着 / 神态，非空项紧凑拼串（details 太细不进摘要）。
function formatAppearance(actor: NonNullable<PublicGameState["actors"][string]>): string {
  const p = actor.presentation;
  return [p.apparentAge, p.outfit.label, p.demeanor]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" · ");
}

function formatActorRelationLine(actor: NonNullable<PublicGameState["actors"][string]>): string {
  const look = formatAppearance(actor);
  const lookTag = look.length > 0 ? `（${look}）` : "";
  return `- **${actor.presentation.renderName}**${lookTag}：${actor.relationshipToProtagonist.summary}`;
}

export function buildRelationsMarkdown(publicState: PublicGameState): string {
  const sections: string[] = ["## 关系概览", ""];

  // 1. Ally relationships
  const protagonist = publicState.actors[publicState.protagonistActorId];
  if (protagonist !== undefined) {
    sections.push(`### ${protagonist.presentation.renderName}（你）`, "");
    const protagonistLook = formatAppearance(protagonist);
    if (protagonistLook.length > 0) {
      sections.push(`- 外观：${protagonistLook}`, "");
    }
  }

  const allies = publicState.allyActorIds
    .map((id) => publicState.actors[id])
    .filter((actor) => actor !== undefined);
  if (allies.length > 0) {
    sections.push("### 同行者", "");
    for (const ally of allies) {
      sections.push(formatActorRelationLine(ally));
    }
    sections.push("");
  }

  // 2. Present NPCs (non-ally)
  const allySet = new Set(publicState.allyActorIds);
  const presentNpcs = publicState.scene.presentActorIds
    .filter((id) => id !== publicState.protagonistActorId && !allySet.has(id))
    .map((id) => publicState.actors[id])
    .filter((actor) => actor !== undefined);
  if (presentNpcs.length > 0) {
    sections.push("### 当前在场", "");
    for (const npc of presentNpcs) {
      sections.push(formatActorRelationLine(npc));
    }
    sections.push("");
  }

  // 3. Impression cards for present actors
  const presentImpressions = Object.values(publicState.actorImpressions).filter((card) =>
    publicState.scene.presentActorIds.includes(card.actorId),
  );
  if (presentImpressions.length > 0) {
    sections.push("### 印象", "");
    for (const card of presentImpressions) {
      const name = publicState.actors[card.actorId]?.presentation.renderName ?? card.actorId;
      sections.push(`**${name}**`);
      sections.push(`- 气场：${card.presence}`);
      sections.push(`- 行动风格：${card.actionStyle}`);
      sections.push(`- 对你的姿态：${card.relationshipPosture}`);
      if (card.voiceMaterial.length > 0) {
        sections.push(`- 语气：${card.voiceMaterial}`);
      }
      sections.push("");
    }
  }

  // 4. Recent relationship signals
  const signals = recentPlayerKnownRelationshipSignals(publicState, 10);
  if (signals.length > 0) {
    sections.push("### 最近关系变化", "");
    for (const signal of signals) {
      const actor = publicState.actors[signal.actorId]?.presentation.renderName ?? signal.actorId;
      const target =
        publicState.actors[signal.targetActorId]?.presentation.renderName ?? signal.targetActorId;
      sections.push(`- **${actor}** → **${target}**：${signal.signal}`);
      sections.push(`  - 解读：${signal.interpretation}`);
      sections.push(`  - 边界：${signal.boundary}`);
    }
    sections.push("");
  }

  if (allies.length === 0 && presentNpcs.length === 0 && signals.length === 0) {
    sections.push("暂无可见关系数据。");
  }

  return sections.join("\n").trimEnd();
}

// ─── /hooks ──────────────────────────────────────────────────────

const HOOK_STATUS_LABELS: Record<string, string> = {
  active: "🔴 进行中",
  parked: "⏸️ 暂搁",
  paid: "✅ 已兑现",
  escalated: "⚡ 已升级",
  retired: "🔒 已退场",
};

export function buildHooksMarkdown(publicState: PublicGameState): string {
  const sections: string[] = ["## 悬念账本", ""];

  const hooks = publicState.hooks;
  if (hooks.length === 0) {
    sections.push("暂无追踪中的悬念。");
    return sections.join("\n").trimEnd();
  }

  const active = hooks.filter((h) => h.status === "active" || h.status === "escalated");
  const parked = hooks.filter((h) => h.status === "parked");
  const resolved = hooks.filter((h) => h.status === "paid" || h.status === "retired");

  if (active.length > 0) {
    sections.push("### 活跃", "");
    for (const hook of active) {
      const label = HOOK_STATUS_LABELS[hook.status] ?? hook.status;
      sections.push(`- ${label} **${hook.label}**（出现 ${hook.surfaceCount} 次）`);
    }
    sections.push("");
  }

  if (parked.length > 0) {
    sections.push("### 暂搁", "");
    for (const hook of parked) {
      sections.push(
        `- ${HOOK_STATUS_LABELS["parked"]} **${hook.label}**（出现 ${hook.surfaceCount} 次）`,
      );
    }
    sections.push("");
  }

  if (resolved.length > 0) {
    sections.push("### 已结", "");
    for (const hook of resolved) {
      const label = HOOK_STATUS_LABELS[hook.status] ?? hook.status;
      sections.push(`- ${label} **${hook.label}**`);
    }
    sections.push("");
  }

  return sections.join("\n").trimEnd();
}

// ─── /journal ────────────────────────────────────────────────────

export function buildJournalMarkdown(publicState: PublicGameState): string {
  const sections: string[] = ["## 事件日志", ""];

  // Timeline from eventLog
  const events = publicState.memory.eventLog;
  if (events.length === 0 && publicState.turnLog.length === 0) {
    sections.push("暂无记录。");
    return sections.join("\n").trimEnd();
  }

  // Daily summaries first
  if (publicState.memory.dailySummaries.length > 0) {
    sections.push("### 每日总结", "");
    for (const summary of publicState.memory.dailySummaries) {
      sections.push(`**${summary.startDate} ～ ${summary.endDate}**`);
      sections.push(summary.summary, "");
    }
  }

  // Major events
  if (events.length > 0) {
    sections.push("### 重大事件", "");
    for (const event of events) {
      const time = formatHumanTime(event.time, publicState.clock.timezone);
      sections.push(`- **${time.display}** — ${event.title}`);
      sections.push(`  ${event.summary}`);
      if (event.consequences.length > 0) {
        sections.push(`  → ${event.consequences.join("；")}`);
      }
    }
    sections.push("");
  }

  // Turn log summary
  if (publicState.turnLog.length > 0) {
    sections.push("### 回合记录", "");
    const recent = publicState.turnLog.slice(-10);
    for (const turn of recent) {
      const time = formatHumanTime(turn.endedAt, publicState.clock.timezone);
      sections.push(`- **${time.display}** — ${turn.summary}`);
    }
    if (publicState.turnLog.length > 10) {
      sections.push(`- …（共 ${publicState.turnLog.length} 轮，仅显示最近 10 轮）`);
    }
    sections.push("");
  }

  return sections.join("\n").trimEnd();
}

// ─── /recap ──────────────────────────────────────────────────────

export function buildRecapMarkdown(publicState: PublicGameState): string {
  const sections: string[] = ["## 前情提要", ""];
  const time = formatHumanTime(publicState.clock.currentAt, publicState.clock.timezone);

  sections.push(`**当前时间**：${time.display}`, "");

  // Campaign premise
  sections.push(`**战役**：${publicState.campaign.title}`, "");
  sections.push(publicState.campaign.premise, "");

  // Protagonist
  const protagonist = publicState.actors[publicState.protagonistActorId];
  if (protagonist !== undefined) {
    sections.push(`**你是**：${protagonist.presentation.renderName}`, "");
    sections.push(protagonist.identity.publicIdentity, "");
    if (protagonist.identity.background.length > 0) {
      sections.push(protagonist.identity.background, "");
    }
  }

  // Key facts
  const keyFacts = publicState.memory.pinnedFacts.filter(
    (fact) => fact.scope === "world" || fact.scope === "protagonist",
  );
  if (keyFacts.length > 0) {
    sections.push("### 关键事实", "");
    for (const fact of keyFacts.slice(-8)) {
      sections.push(`- ${fact.subject}：${fact.text}`);
    }
    sections.push("");
  }

  // Recent events
  const recentEvents = publicState.memory.eventLog.slice(-5);
  if (recentEvents.length > 0) {
    sections.push("### 最近发生", "");
    for (const event of recentEvents) {
      sections.push(`- **${event.title}**：${event.summary}`);
    }
    sections.push("");
  }

  // Active hooks
  const activeHooks = publicState.hooks.filter(
    (hook) => hook.status === "active" || hook.status === "escalated",
  );
  if (activeHooks.length > 0) {
    sections.push("### 当前悬念", "");
    for (const hook of activeHooks) {
      const label = hook.status === "escalated" ? "⚡" : "🔴";
      sections.push(`- ${label} ${hook.label}`);
    }
    sections.push("");
  }

  // Current scene
  const location = [
    publicState.scene.location.region,
    publicState.scene.location.site,
    publicState.scene.location.detail,
  ]
    .filter((part) => part.length > 0)
    .join(" · ");
  sections.push(`### 当前场景`, "");
  sections.push(`- 地点：${location}`);
  sections.push(`- 态势：${publicState.scene.situation}`);

  const activeObjectives = publicState.scene.objectives.filter((obj) => obj.status !== "resolved");
  if (activeObjectives.length > 0) {
    sections.push(`- 目标：${activeObjectives.map((obj) => obj.summary).join("；")}`);
  }
  const threats = publicState.scene.threats;
  if (threats.length > 0) {
    sections.push(`- 威胁：${threats.map((t) => `[${t.severity}] ${t.summary}`).join("；")}`);
  }

  return sections.join("\n").trimEnd();
}
