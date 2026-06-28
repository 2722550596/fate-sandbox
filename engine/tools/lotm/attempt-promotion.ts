// ---------------------------------------------------------------------------
// attempt_promotion — 序列晋升裁决工具
//
// 模式与 resolve_combat_exchange 一致：
//   引擎只裁决，不改状态。
//   输出 outcome bands + narrative constraints + state landings，
//   必须落地的状态变更记入义务账本（obligations ledger）。
//
// GM 在叙事完成后通过 commit_turn 清账：
//   - { kind: "sequence", event: { actorId, currentSequence, rank, pathway, ... } }
//   - { kind: "memory", event: ... }
//   - { kind: "actor-condition", event: ... }
//   - scene event（add-threat / add-objective）
//   - reveal_secret 工具
// ---------------------------------------------------------------------------

import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { recordObligation } from "../../core/ledger/obligations.ts";
import {
  resolveLOTMPromotion,
  type LOTMPromotionInput,
} from "../../core/promotion/promotion-exchange-lotm.ts";
import { PATHWAY_DISPLAY_NAMES, RANK_DISPLAY_NAMES } from "../../core/state/pathway-names.ts";
import { SEQUENCE_RANKS } from "../../core/state/state-enum-schemas.ts";
import { createId } from "../../core/utils/ids.ts";
import { assertOneOfString } from "../../core/utils/string-enum.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { lookupStructuredAbilities } from "../lookup/ability-lookup.ts";
import { noNumberNarrativeHint } from "../runtime/narrative-hints.ts";
import { runDomainEventTool } from "../system/domain-tool-runner.ts";

// ===========================================================================
// 主处理函数
// ===========================================================================

export function attemptPromotionTool(params: unknown, sessionManager: unknown): ToolResult {
  const raw = isRecord(params) ? params : {};

  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      const actorId = typeof raw["actorId"] === "string" ? raw["actorId"] : "";
      if (!actorId) throw new Error("attempt_promotion: 缺少 actorId。");

      const actor = draft.public.actors[actorId];
      if (!actor) throw new Error(`attempt_promotion: actor 不存在: ${actorId}。`);
      if (!actor.sequence) throw new Error(`attempt_promotion: actor ${actorId} 不是非凡者。`);

      const actingCueCount = actor.sequence.actingCues.length;
      const targetRank = assertOneOfString(raw["targetRank"], SEQUENCE_RANKS, "targetRank");

      const input: LOTMPromotionInput = {
        actorId,
        currentRank: actor.sequence.rank,
        targetRank,
        actingCueCount,
        ritualIntegrity: assertOneOfString(
          typeof raw["ritualIntegrity"] === "string" ? raw["ritualIntegrity"] : "standard",
          ["none", "improvised", "standard", "enhanced"],
          "ritualIntegrity",
        ),
        environmentRisk: assertOneOfString(
          typeof raw["environmentRisk"] === "string" ? raw["environmentRisk"] : "safe",
          ["safe", "disturbed", "hostile", "chaotic"],
          "environmentRisk",
        ),
        riskTolerance: assertOneOfString(
          typeof raw["riskTolerance"] === "string" ? raw["riskTolerance"] : "medium",
          ["low", "medium", "high", "desperate"],
          "riskTolerance",
        ),
        hasMainCharacteristic: raw["hasMainCharacteristic"] === true,
        hasSupplementaryMaterials: raw["hasSupplementaryMaterials"] === true,
      };

      const result = resolveLOTMPromotion(draft, input);
      const landings = result.stateLandings;
      const successOutcomes = new Set(["triumph", "success-with-cost", "scarred-success"]);

      let abilityCount = 0;
      if (successOutcomes.has(result.outcome)) {
        // 1. 序列等级更新 + 扮演记录重置
        actor.sequence.rank = targetRank;
        actor.sequence.actingCues = [];

        // 2. 序列名更新
        const pathwayName = PATHWAY_DISPLAY_NAMES[actor.sequence.pathway] ?? actor.sequence.pathway;
        const rankLabel = RANK_DISPLAY_NAMES[targetRank] ?? targetRank;
        const abilities = lookupStructuredAbilities(pathwayName, rankLabel);
        actor.abilities = abilities.map((a) => ({
          id: createId(draft, "ability"),
          label: a.name,
          summary: a.description,
        }));
        abilityCount = abilities.length;
      }

      // 记录必须落地的义务（过滤掉已自动处理的 actor-sequence）
      const recorded = landings
        .filter((l) => l.required && l.kind !== "actor-sequence")
        .map((l) =>
          recordObligation(draft, {
            source: "promotion",
            kind: landingKindToObligationKind(l.kind),
            summary: l.reason,
          }),
        );

      return {
        result,
        recordedObligations: recorded.length,
        abilityCount,
        didAutoWrite: successOutcomes.has(result.outcome),
      };
    },
    details: ({ result }) => ({ result }),
    message: ({ result, recordedObligations, abilityCount, didAutoWrite }) =>
      formatPromotionResult(result, recordedObligations, abilityCount, didAutoWrite),
  });
}

// ===========================================================================
// 状态落点 kind → TurnObligationKind 映射
// ===========================================================================

// eslint-disable-next-line consistent-return — exhaustive switch over union
function landingKindToObligationKind(
  kind: import("../../core/promotion/promotion-exchange-lotm.ts").LOTMPromotionStateLandingKind,
): import("../../core/state/state.ts").TurnObligationKind {
  switch (kind) {
    case "actor-sequence":
      return "sequence";
    case "actor-condition":
      return "actor-condition";
    case "inventory":
      return "tracked-item";
    case "scene-threat":
      return "scene-threat";
    case "memory":
      return "memory";
    case "reveal-secret":
      return "reveal-secret";
  }
}

// ===========================================================================
// 输出格式化
// ===========================================================================

export function formatPromotionResult(
  result: import("../../core/promotion/promotion-exchange-lotm.ts").LOTMPromotionResult,
  recordedObligations: number,
  abilityCount: number,
  didAutoWrite: boolean,
): string {
  const lines: string[] = [
    `晋升裁决：${result.outcome}`,
    `目标等级：${result.targetRank}`,
    `扮演准备：${result.actingReadiness}（${result.actingCueCount} 条）`,
    `综合偏移：${result.totalModifier > 0 ? "+" : ""}${result.totalModifier}`,
  ];

  if (didAutoWrite) {
    lines.push(
      "",
      `✅ 序列已自动更新：${result.targetRank}`,
      `✅ 已自动填充 ${abilityCount} 项新能力`,
    );
  }

  lines.push(
    "",
    "状态落点：",
    ...result.stateLandings.map(formatLanding),
    "",
    "后果引导：",
    ...uniqueLines(result.consequenceGuidance).map((l) => `- ${l}`),
    "",
    "叙事约束：",
    ...uniqueLines([...result.narrativeConstraints, noNumberNarrativeHint()]).map((l) => `- ${l}`),
    "",
    "禁止写法：",
    ...uniqueLines(result.forbiddenNarration).map((l) => `- ${l}`),
    "",
    `下一行动窗口：${result.nextActionWindow}`,
  );

  if (recordedObligations > 0) {
    lines.push(
      "",
      `⚠ 已登记 ${recordedObligations} 条必须落地的义务；本轮 canonical commit 前必须用对应状态事件清账。`,
    );
  }

  return lines.join("\n");
}

function formatLanding(
  landing: import("../../core/promotion/promotion-exchange-lotm.ts").LOTMPromotionStateLanding,
): string {
  return `- ${landing.required ? "必须" : "可选"} ${landing.kind}: ${landing.reason}`;
}

function uniqueLines(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      unique.push(trimmed);
    }
  }
  return unique;
}

// ===========================================================================
// 工具注册
// ===========================================================================

export const attemptPromotionToolDefinition: DomainToolDefinition = {
  name: "attempt_promotion",
  description:
    "序列晋升裁决。引擎根据序列等级差、扮演积累条数、仪式完整性、环境风险和材料完备度\n" +
    "输出 outcome bands + narrative constraints + 必须落地的状态变更义务。\n\n" +
    "【成功时自动处理】\n" +
    "晋升成功（triumph / success-with-cost / scarred-success）时引擎自动：\n" +
    "- 更新 actor 序列等级（actor.sequence.rank → targetRank）\n" +
    "- 重置扮演记录（actingCues = []）\n" +
    "- 从 data/abilities/pathway_abilities.json 自动填充该等级能力\n\n" +
    "其余必须落地的义务记入账本，GM 后续通过 commit_turn 或其他工具清账：\n" +
    "- actor-condition → update_actor_condition 或 commit_turn\n" +
    "- inventory → update_tracked_item 或 commit_turn\n" +
    "- scene-threat → commit_turn 的 add-threat 事件\n" +
    "- memory → record_memory 或 commit_turn\n" +
    "- reveal-secret → reveal_secret 工具\n\n" +
    "使用边界：玩家角色或 NPC 的序列晋升。\n" +
    "禁区：用此工具代管非序列状态变更，或跳过叙事直接晋升。",
  parameters: Type.Object({
    actorId: Type.String({ minLength: 1, description: "晋升目标 actor id" }),
    targetRank: Type.String({
      description:
        "目标序列等级（seq-9 / seq-8 / seq-7 / seq-6 / seq-5 / seq-4 / seq-3 / seq-2 / seq-1 / seq-0 / old-one / pillar）",
    }),
    ritualIntegrity: Type.Optional(
      Type.String({
        description: "仪式完成度：none / improvised / standard（默认） / enhanced",
      }),
    ),
    environmentRisk: Type.Optional(
      Type.String({ description: "环境风险：safe（默认） / disturbed / hostile / chaotic" }),
    ),
    hasMainCharacteristic: Type.Optional(
      Type.Boolean({ description: "是否拥有主非凡特性/材料（默认 false）" }),
    ),
    hasSupplementaryMaterials: Type.Optional(
      Type.Boolean({ description: "是否拥有辅助材料（默认 false）" }),
    ),
    riskTolerance: Type.Optional(
      Type.String({
        description: "风险偏好：low / medium（默认） / high / desperate",
      }),
    ),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    attemptPromotionTool(params, ctx.sessionManager),
};
