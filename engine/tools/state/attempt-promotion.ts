import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { ToolResult } from "../runtime/tool-result.ts";
import type { SequenceInput } from "../../core/actor/actor-schema.ts";

import { cloneState, commitState } from "../../core/state/state-store.ts";
import { persistStateAfterCommit } from "../../core/state/state-persistence.ts";
import { textResult } from "../runtime/tool-result.ts";
import { upsertActor } from "../../core/actor/actor.ts";
import { performJudgment } from "../../core/utils/judgment.ts";
import type { DifficultyLevel } from "../../core/state/state-enum-schemas.ts";

export function attemptPromotionTool(params: unknown, sessionManager: unknown): ToolResult {
  const { actorId, targetRank, targetName, pathway, divinity, digestionProgress, luck, agility } =
    parsePromotionParams(params);
  const draft = cloneState();

  const actor = draft.public.actors[actorId];
  if (actor === undefined) {
    return textResult(`actor 不存在: ${actorId}。先用 get_status 查看可用 actor。`, { error: "actor_not_found" });
  }

  // 计算当前消化进度是否足够晋升
  if (digestionProgress < 80) {
    return textResult(
      `晋升失败：消化进度不足（${digestionProgress}% < 80%）。请先继续扮演消化魔药。`,
      { digestionProgress, requiredDigestion: 80, success: false },
    );
  }

  // 晋升判定：基于目标序列等级设定难度 + 运气修正
  const difficulty = rankToDifficulty(targetRank);
  const judgmentResult = performJudgment(
    {
      sequenceRank: "ordinary",
      difficulty,
      attributes: [agility ?? 50, luck ?? 10],
      luck: luck ?? 10,
    },
    () => Math.floor(Math.random() * 100) + 1,
  );

  const success = judgmentResult.outcome !== "failure" && judgmentResult.outcome !== "loss-of-control";

  if (success) {
    // 晋升成功：更新 actor 序列
    const seqInput: SequenceInput = {
      actorId,
      currentSequence: targetName,
      rank: targetRank as SequenceInput["rank"],
      pathway: pathway as SequenceInput["pathway"],
      promotionSystem: "potion",
      divinity: divinity ?? 0,
      digestionProgress: 0,
      lossOfControlProgress: 0,
      reason: `晋升至 ${targetName}`,
    };

    upsertActor(draft, { kind: "upsert-sequence", sequence: seqInput, reason: `晋升至 ${targetName}` });

    commitState(draft);
    persistStateAfterCommit(sessionManager, {
      result: { actorId, targetRank, targetName, success: true, judgmentResult },
    });
    return textResult(
      `【晋升成功】${actorId} 成功晋升至 ${targetName}！${judgmentResult.details}`,
      {
        actorId,
        targetRank,
        targetName,
        success: true,
        judgment: {
          diceValue: judgmentResult.diceValue,
          threshold: judgmentResult.threshold,
          outcome: judgmentResult.outcome,
        },
      },
    );
  }

  // 晋升失败：可能失控
  const lossOfControlIncrease = judgmentResult.outcome === "loss-of-control"
    ? Math.floor(Math.random() * 30) + 10
    : Math.floor(Math.random() * 10) + 5;

  commitState(draft);
  persistStateAfterCommit(sessionManager, {
    result: { actorId, targetRank, success: false, lossOfControlIncrease, judgmentResult },
  });
  return textResult(
    `【晋升失败】${actorId} 未能晋升至 ${targetName}。${judgmentResult.outcome === "loss-of-control" ? "⚠️ 失控风险大幅增加！" : ""}\n${judgmentResult.details}\n失控进度增加 ${lossOfControlIncrease}%。`,
    {
      actorId,
      targetRank,
      success: false,
      lossOfControlIncrease,
      judgment: {
        diceValue: judgmentResult.diceValue,
        threshold: judgmentResult.threshold,
        outcome: judgmentResult.outcome,
      },
    },
  );
}

/** 根据目标序列等级映射判定难度 */
function rankToDifficulty(rank: string): DifficultyLevel {
  const map: Record<string, DifficultyLevel> = {
    "seq-9": "trivial",
    "seq-8": "ordinary",
    "seq-7": "tricky",
    "seq-6": "tricky",
    "seq-5": "near-impossible",
    "seq-4": "near-impossible",
    "seq-3": "blasphemous",
    "seq-2": "blasphemous",
    "seq-1": "blasphemous",
    "seq-0": "blasphemous",
  };
  return map[rank] ?? "ordinary";
}

interface PromotionParams {
  actorId: string;
  targetRank: string;
  targetName: string;
  pathway: string;
  divinity: number;
  digestionProgress: number;
  luck: number;
  agility: number;
}

function parsePromotionParams(params: unknown): PromotionParams {
  const raw = params as Record<string, unknown>;
  return {
    actorId: typeof raw.actorId === "string" && raw.actorId.length > 0 ? raw.actorId : "",
    targetRank: typeof raw.targetRank === "string" ? raw.targetRank : "seq-9",
    targetName: typeof raw.targetName === "string" ? raw.targetName : "序列9",
    pathway: typeof raw.pathway === "string" ? raw.pathway : "seer",
    divinity: typeof raw.divinity === "number" ? raw.divinity : 0,
    digestionProgress: typeof raw.digestionProgress === "number" ? raw.digestionProgress : 0,
    luck: typeof raw.luck === "number" ? raw.luck : 10,
    agility: typeof raw.agility === "number" ? raw.agility : 50,
  };
}

export const attemptPromotionToolDefinition: FateToolDefinition = {
  name: "attempt_promotion",
  description:
    "尝试一次序列晋升。检查消化进度（需 ≥80%），执行序列基准判定，成功则更新 actor 序列状态。\n\n" +
    "使用边界：玩家角色或 NPC 的序列晋升流程；晋升前确保消化进度足够、仪式条件已满足。\n" +
    "禁区：不跳过消化进度检查直接写入高序列；不随意降低失控风险；晋升失败的失控风险需要通过后续叙事处理。",
  parameters: Type.Object({
    actorId: Type.String({ minLength: 1, description: "目标 actor id" }),
    targetRank: Type.String({
      description: "目标序列等级: seq-9 / seq-8 / seq-7 / seq-6 / seq-5 / seq-4 / seq-3 / seq-2 / seq-1 / seq-0",
    }),
    targetName: Type.String({ description: "目标序列名称，如「序列9-占卜家」「序列7-魔术师」" }),
    pathway: Type.String({ description: "途径 ID，如 seer / thief / spectator 等" }),
    divinity: Type.Optional(Type.Number({ description: "晋升后的神性值（默认 0）" })),
    digestionProgress: Type.Number({ description: "当前消化进度 0-100（需 ≥80 才能晋升）" }),
    ritualDetails: Type.Optional(Type.String({ description: "仪式描述，影响叙事呈现" })),
    luck: Type.Optional(Type.Number({ description: "角色运气值，用于晋升判定修正" })),
    agility: Type.Optional(Type.Number({ description: "角色敏捷值，用于晋升判定" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    attemptPromotionTool(params, ctx.sessionManager),
};