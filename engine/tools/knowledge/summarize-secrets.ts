import type {
  ActorSecretSlots,
  HiddenWorldFact,
  SecretEventMemory,
  State,
} from "../../core/state/state.ts";
import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { hydrateStateFromSessionManager } from "../../core/state/session-persistence.ts";
import { getState } from "../../core/state/state-store.ts";
import { textResult } from "../runtime/tool-result.ts";

// ===========================================================================
// 格式化层
// ===========================================================================

const REVEAL_STATE_ICON: Record<string, string> = {
  hidden: "🔒",
  foreshadowed: "🔮",
  revealed: "✅",
};

function formatSecretSlots(label: string, slots: ActorSecretSlots["beyonderSecrets"]): string[] {
  if (slots.length === 0) return [];
  const lines: string[] = [];
  lines.push(`  ${label}（${slots.length}项）`);
  for (const s of slots) {
    const icon = REVEAL_STATE_ICON[s.revealState] ?? "❓";
    if (s.revealState === "revealed") {
      lines.push(`    ${icon} ${s.value}`);
    } else {
      const conditions =
        s.revealConditions.length > 0 ? `  ← 线索: ${s.revealConditions.join("、")}` : "";
      lines.push(`    ${icon} ${s.value}${conditions}`);
    }
  }
  return lines;
}

function buildActorSecretsSummary(
  actorStates: State["secrets"]["actorStates"],
  protagonistActorId: string,
): string[] {
  const lines: string[] = [];
  const entries = Object.entries(actorStates);

  if (entries.length === 0) {
    lines.push("（无 actor 秘密）");
    return lines;
  }

  for (const [actorId, actorSecrets] of entries) {
    if (actorSecrets === undefined) continue;
    const label = actorId === protagonistActorId ? `【${actorId}（主角）】` : `【${actorId}】`;
    lines.push(label);

    const slots = actorSecrets.secrets;
    const beyonder =
      slots !== undefined ? formatSecretSlots("非凡秘密", slots.beyonderSecrets) : [];
    const motives = slots !== undefined ? formatSecretSlots("个人动机", slots.privateMotives) : [];
    const affiliations =
      slots !== undefined ? formatSecretSlots("未公开关联", slots.unrevealedAffiliations) : [];

    let hasAny = false;
    for (const block of [beyonder, motives, affiliations]) {
      if (block.length > 0) {
        lines.push(...block);
        hasAny = true;
      }
    }
    if (!hasAny) {
      lines.push("  （无配置的秘密）");
    }
    lines.push("");
  }

  return lines;
}

function buildWorldFactsSummary(facts: HiddenWorldFact[]): string[] {
  const lines: string[] = [];
  if (facts.length === 0) {
    lines.push("（无世界隐藏事实）");
    return lines;
  }

  lines.push("【世界隐藏事实】");
  for (const f of facts) {
    const icon = REVEAL_STATE_ICON[f.revealState] ?? "❓";
    if (f.revealState === "revealed") {
      lines.push(`  ${icon} ${f.text}`);
    } else {
      const related =
        f.relatedActorIds.length > 0 ? `（关联: ${f.relatedActorIds.join("、")}）` : "";
      const conditions =
        f.revealConditions.length > 0 ? `  ← 线索: ${f.revealConditions.join("、")}` : "";
      lines.push(`  ${icon} ${f.text}${related}${conditions}`);
    }
  }
  return lines;
}

function buildEventLogSummary(events: SecretEventMemory[]): string[] {
  if (events.length === 0) return [];
  const lines: string[] = ["【揭示事件日志】"];
  // 只展示最近 5 条
  const recent = events.slice(-5);
  for (const e of recent) {
    const related = e.relatedActorIds.length > 0 ? ` → ${e.relatedActorIds.join("、")}` : "";
    lines.push(`  ${e.time.slice(0, 19)} ${e.summary}${related}`);
  }
  return lines;
}

export function buildSecretsSummary(state: State): string {
  const lines: string[] = [
    "=== 秘密状态摘要 ===",
    "",
    ...buildActorSecretsSummary(state.secrets.actorStates, state.public.protagonistActorId),
    ...buildWorldFactsSummary(state.secrets.hiddenWorldFacts),
    "",
    ...buildEventLogSummary(state.secrets.secretEventLog),
  ];

  return lines.join("\n");
}

// ===========================================================================
// 工具入口
// ===========================================================================

export function summarizeSecretsTool(sessionManager?: unknown): ToolResult {
  if (sessionManager !== undefined) {
    hydrateStateFromSessionManager(sessionManager);
  }
  const state = getState();
  return textResult(buildSecretsSummary(state));
}

export const summarizeSecretsToolDefinition: DomainToolDefinition = {
  name: "summarize_secrets",
  description:
    "查看所有 actor 和世界的秘密状态摘要：揭示状态（隐藏/预感/揭示）、线索词、揭示事件日志。\n\n" +
    "使用边界：需要了解有哪些未揭示秘密/剩余线索、确认某个 actor 的秘密揭示进度、或查看已发生的揭示事件。\n" +
    "禁区：配置新秘密（用 configure_secret）、执行秘密揭示（用 reveal_secret）、或作为 debug 原始 JSON 视图。",
  parameters: Type.Object({}),
  execute: async (_toolCallId, _params, _signal, _onUpdate, ctx) =>
    summarizeSecretsTool(ctx.sessionManager),
};
