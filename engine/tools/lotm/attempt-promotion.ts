// ---------------------------------------------------------------------------
// attempt_promotion — 序列晋升工具
//
// 叙事先验版本：引擎不做骰子判定、不计算失控值增加。
// 引擎只检查消化进度（需 ≥80%），晋升结果由 LLM 叙事决定。
// 晋升成功通过 upsert_actor 更新序列状态，失败通过 update_corruption 增加失控值。
//
// 设计哲学：
//   - 晋升的难度取决于：仪式完成度、环境因素、消化进度——这些都是叙事层面的判断
//   - 引擎只确保 "消化不够就不能晋升" 这个硬边界
// ---------------------------------------------------------------------------

import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { upsertActor } from "../../core/actor/actor.ts";
import { SEQUENCE_RANKS, PATHWAY_IDS } from "../../core/state/state-enum-schemas.ts";
import { persistStateAfterCommit } from "../../core/state/state-persistence.ts";
import { cloneState, commitState } from "../../core/state/state-store.ts";
import { assertOneOfString } from "../../core/utils/string-enum.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult } from "../runtime/tool-result.ts";

export function attemptPromotionTool(params: unknown, sessionManager: unknown): ToolResult {
  const { actorId, targetRank, targetName, pathway, divinity, digestionProgress } =
    parsePromotionParams(params);
  const draft = cloneState();

  const actor = draft.public.actors[actorId];
  if (actor === undefined) {
    return textResult(`actor 不存在: ${actorId}。先用 get_status 查看可用 actor。`, {
      error: "actor_not_found",
    });
  }

  // 唯一硬边界：消化进度必须 ≥80%
  if (digestionProgress < 80) {
    return textResult(
      `晋升失败：消化进度不足（${digestionProgress}% < 80%）。请先继续扮演消化魔药。`,
      { digestionProgress, requiredDigestion: 80, success: false },
    );
  }

  // 晋升结果由 LLM 叙事判断，引擎只更新状态
  // LLM 在调用之前已经通过叙事判断了"仪式是否完成、环境是否合适"
  // 这里默认允许，因为叙事层已经通过了

  // 晋升成功：更新 actor 的 sequence 信息
  upsertActor(draft, {
    kind: "upsert-sequence",
    sequence: {
      actorId,
      currentSequence: targetName,
      rank: assertOneOfString(targetRank, SEQUENCE_RANKS, "targetRank"),
      pathway: assertOneOfString(pathway, PATHWAY_IDS, "pathway"),
      promotionSystem: "potion",
      divinity: divinity ?? 0,
      digestionProgress: 0,
      lossOfControlProgress: 0,
      reason: `晋升至 ${targetName}`,
    },
    reason: `晋升至 ${targetName}`,
  });

  commitState(draft);
  persistStateAfterCommit(sessionManager, {
    result: { actorId, targetRank, targetName, success: true },
  });

  return textResult(`【晋升成功】${actorId} 成功晋升至 ${targetName}！`, {
    actorId,
    targetRank,
    targetName,
    success: true,
  });
}

interface PromotionParams {
  actorId: string;
  targetRank: string;
  targetName: string;
  pathway: string;
  divinity: number;
  digestionProgress: number;
}

function parsePromotionParams(params: unknown): PromotionParams {
  const raw = isRecord(params) ? params : {};
  return {
    actorId: typeof raw.actorId === "string" && raw.actorId.length > 0 ? raw.actorId : "",
    targetRank: typeof raw.targetRank === "string" ? raw.targetRank : "seq-9",
    targetName: typeof raw.targetName === "string" ? raw.targetName : "序列9",
    pathway: typeof raw.pathway === "string" ? raw.pathway : "seer",
    divinity: typeof raw.divinity === "number" ? raw.divinity : 0,
    digestionProgress: typeof raw.digestionProgress === "number" ? raw.digestionProgress : 0,
  };
}

export const attemptPromotionToolDefinition: FateToolDefinition = {
  name: "attempt_promotion",
  description:
    "序列晋升。引擎只检查消化进度（需 ≥80%），不计算骰子判定或失控值。\n\n" +
    "晋升成功时引擎自动更新 actor 的 sequence 状态。\n" +
    "晋升失败的后果（失控值增加等）由 LLM 调用 update_corruption 处理。\n\n" +
    "使用边界：玩家角色或 NPC 的序列晋升流程。\n" +
    "禁区：跳过消化进度检查直接写入高序列。",
  parameters: Type.Object({
    actorId: Type.String({ minLength: 1, description: "目标 actor id" }),
    targetRank: Type.String({ description: "目标序列等级" }),
    targetName: Type.String({ description: "目标序列名称" }),
    pathway: Type.String({ description: "途径 ID" }),
    divinity: Type.Optional(Type.Number({ description: "晋升后的神性值（默认 0）" })),
    digestionProgress: Type.Number({ description: "当前消化进度 0-100（需 ≥80 才能晋升）" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    attemptPromotionTool(params, ctx.sessionManager),
};
