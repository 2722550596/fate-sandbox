import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import { randomInt } from "node:crypto";

import {
  formatCombatSwing,
  resolveCombatExchange,
  type CombatExchangeResult,
  type CombatStateLanding,
  type CombatSwing,
} from "../../engine/core/combat-exchange.ts";
import { parseCombatExchangeInput } from "../../engine/core/combat-exchange-schema.ts";
import { getState } from "../../engine/core/state-store.ts";
import { writeStateToDetails } from "../../engine/core/state-persistence.ts";
import { noNumberNarrativeHint } from "../runtime/narrative-hints.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

export function resolveCombatExchangeTool(params: unknown, _sessionManager: unknown): ToolResult {
  const input = parseCombatExchangeInput(params, "resolve_combat_exchange 参数");
  const result = resolveCombatExchange(getState(), { ...input, swing: input.swing ?? rollCombatSwing() });
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(formatCombatExchangeResult(result), details);
}

function formatCombatExchangeResult(result: CombatExchangeResult): string {
  return [
    `交锋裁决：${result.outcome}`,
    `意图：${result.intent}`,
    `参数/尺度：${result.rankCheck}`,
    `战场变数：${formatCombatSwing(result.swing)}`,
    "",
    "状态落点：",
    ...result.stateLandings.map(formatStateLanding),
    "",
    "后果力度：",
    ...uniqueLines(result.consequenceGuidance).map((line) => `- ${line}`),
    "",
    "叙事约束：",
    ...uniqueLines([...result.narrativeConstraints, noNumberNarrativeHint()]).map((line) => `- ${line}`),
    "",
    "禁止写法：",
    ...uniqueLines(result.forbiddenNarration).map((line) => `- ${line}`),
    "",
    `下一行动窗口：${result.nextActionWindow}`,
  ].join("\n");
}

function formatStateLanding(landing: CombatStateLanding): string {
  const strength = landing.required ? "必须" : "可选";
  return `- ${strength} ${landing.kind}: ${landing.reason}`;
}

function rollCombatSwing(): CombatSwing {
  const roll = randomInt(100);
  if (roll < 10) return "bad-break";
  if (roll < 30) return "pressure";
  if (roll < 70) return "neutral";
  if (roll < 90) return "opening";
  return "turnabout";
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

export const resolveCombatExchangeToolDefinition: FsnToolDefinition = {
  name: "resolve_combat_exchange",
  description:
    "定性裁决当前战斗交锋窗口；比较 Fate 参数/尺度、资源投入、已知优势/劣势和伤势压力，返回结果 band 与必须落地的状态约束。不写 HP，不直接改状态。\n\n" +
    "【必须调用的场景】\n" +
    "- 战斗、撤退、保护、破除拘束、试探能力、宝具前摇/解放等高风险交锋需要机械裁决\n" +
    "- 双方有从者参数、魔术资质、伤势、地形、情报或资源投入差异，不能只靠 GM 口胡胜负\n" +
    "- 玩家行动试图争取局部目标：挡下一击、逼退、撤离、保护 NPC、打断术式、识破能力或创造出手机会\n" +
    "- 工具会自动加入战场变数，等级压制不是静态锁死；变数只能兑现为局部窗口、资源交换或后果扩大\n" +
    "- tactic=noble-phantasm 且比较 noblePhantasm 时，具体宝具 rank 与面板宝具参数分开；多宝具必须指定公开宝具名\n\n" +
    "【严禁的行为】\n" +
    "- 用它一次结算完整战斗或跳过玩家可回应窗口\n" +
    "- 把交锋结果写成原地僵持；每次结果都必须改变位置、距离、资源、情报、阵型或目标进度\n" +
    "- 让模型先决定胜负再反填优势/劣势；输入必须是玩家可见事实、已投入资源和已知压力\n" +
    "- 把 outcome 当成自动状态变更；伤势、魔力、目标、记忆、秘密揭示仍必须用对应领域工具落地\n" +
    "- 输出内部 score、HP、DC 或未揭示真名/宝具/弱点给玩家",
  parameters: Type.Object({
    actorId: Type.String({ description: "发起/承受当前交锋动作的 actor id" }),
    opponentId: Type.String({ description: "主要对手 actor id" }),
    intent: Type.String({ description: "当前动作意图，如 破除拘束 / 护住绫香撤退 / 逼退 Rider" }),
    tactic: Type.String({
      description:
        "允许: direct-attack / defense / escape / protect / probe / break-restraint / noble-phantasm / support",
    }),
    actorParameter: Type.String({
      description:
        "本方主要参数轴，允许: strength / endurance / agility / mana / luck / noblePhantasm",
    }),
    opponentParameter: Type.String({
      description:
        "对手主要参数轴，允许: strength / endurance / agility / mana / luck / noblePhantasm",
    }),
    actorNoblePhantasmName: Type.Optional(
      Type.String({
        description: "本方明确释放具体宝具时，逐字复制公开宝具名；若只有一个公开宝具可省略。",
      }),
    ),
    opponentNoblePhantasmName: Type.Optional(
      Type.String({
        description: "对手明确使用具体宝具时，逐字复制公开宝具名；若只有一个公开宝具可省略。",
      }),
    ),
    targetObjective: Type.Optional(
      Type.String({ description: "若交锋服务当前 Scene Objective，逐字写目标摘要" }),
    ),
    committedResources: Type.Optional(
      Type.Array(
        Type.String({
          description: "已明确投入的资源、技能、令咒风险、宝具、地形布置等；无则省略",
        }),
      ),
    ),
    knownAdvantages: Type.Optional(
      Type.Array(Type.String({ description: "玩家可见或工具已确认的有利事实；不要写幕后秘密" })),
    ),
    knownDisadvantages: Type.Optional(
      Type.Array(
        Type.String({
          description: "玩家可见或工具已确认的不利事实、伤势、距离、压制、未知能力等",
        }),
      ),
    ),
    riskTolerance: Type.String({ description: "允许: low / medium / high / desperate" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    resolveCombatExchangeTool(params, ctx.sessionManager),
};
