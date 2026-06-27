// ---------------------------------------------------------------------------
// update_corruption — 失控值变更工具
//
// 设计哲学：
//   引擎不做"越级 N 级 → 加 N*5"的公式计算。
//   等级差造成的失控风险由 consume_item / resolve_combat_exchange 裁决，
//   具体加多少由 LLM 根据叙事上下文判断。
//   引擎只保证：0 ≤ corruption ≤ 100，到达 100 时标记失控。
//
// 对称于 update_actor_condition：失控值是叙事资源，不是数值槽。
// ---------------------------------------------------------------------------

import type { State } from "../../core/state/state.ts";
import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { settleOldestObligation } from "../../core/obligations.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { runDomainEventTool } from "../system/domain-tool-runner.ts";

// ===========================================================================
// 类型
// ===========================================================================

export interface UpdateCorruptionInput {
  actorId: string;
  delta: number;
  reason: string;
}

export interface UpdateCorruptionResult {
  actorId: string;
  before: number;
  after: number;
  delta: number;
  capped: boolean; // 是否被 0-100 边界钳制
  outOfControl: boolean; // 是否因此次变更达到 100
}

// ===========================================================================
// 主函数
// ===========================================================================

export function updateCorruptionTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => executeUpdateCorruption(draft, params),
    details: (result) => ({ result }),
    message: (result) => formatCorruptionResult(result),
  });
}

function executeUpdateCorruption(draft: State, params: unknown): UpdateCorruptionResult {
  const raw = isRecord(params) ? params : {};
  const actorId = typeof raw["actorId"] === "string" ? raw["actorId"] : "";
  const delta = Number(raw["delta"]);
  const reason = typeof raw["reason"] === "string" ? raw["reason"] : "";

  if (!actorId) throw new Error("update_corruption: 缺少 actorId。");
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("update_corruption: delta 必须是有效非零整数。");
  }
  if (!reason) throw new Error("update_corruption: 缺少 reason。");

  const actor = draft.public.actors[actorId];
  if (!actor) throw new Error(`update_corruption: actor 不存在: ${actorId}`);
  if (!actor.sequence) {
    throw new Error(`update_corruption: actor ${actorId} 不是非凡者，没有失控值。`);
  }

  const before = actor.sequence.lossOfControlProgress;
  const rawAfter = before + delta;
  const capped = rawAfter < 0 || rawAfter > 100;
  const after = clamp(rawAfter, 0, 100);
  const outOfControl = after >= 100;

  actor.sequence.lossOfControlProgress = after;

  // 清一条 actor-condition 类的义务（如果来自 consume_item 或 combat 的裁决）
  settleOldestObligation(draft, ["actor-condition"]);

  return {
    actorId,
    before,
    after,
    delta,
    capped,
    outOfControl,
  };
}

function formatCorruptionResult(result: UpdateCorruptionResult): string {
  const direction = result.delta > 0 ? "增加" : "降低";
  const lines: string[] = [
    `${result.actorId} 失控值 ${direction}：${result.before} → ${result.after}（${result.delta > 0 ? "+" : ""}${result.delta}）`,
  ];

  if (result.capped) {
    if (result.after <= 0) {
      lines.push("失控值已降至 0，无法继续降低。");
    } else {
      lines.push("失控值已封顶 100。");
    }
  }

  if (result.outOfControl) {
    lines.push("");
    lines.push("⚠ 失控值已达到 100——角色进入失控状态。");
    lines.push("接下来的叙事必须以失控为核心展开：能力暴走、被动失控事件、或进入失控剧情。");
  }

  return lines.join("\n");
}

// ===========================================================================
// 工具注册
// ===========================================================================

export const updateCorruptionToolDefinition: FateToolDefinition = {
  name: "update_corruption",
  description:
    "更新指定 actor 的失控值（lossOfControlProgress，范围 0~100）。\n\n" +
    "引擎负责边界钳制（0~100）和失控判定（=100 时标记失控）。\n" +
    "具体加多少由叙事上下文决定，引擎不做公式计算。\n\n" +
    "使用边界：消耗品越级使用、高风险能力释放、失控剧情推进。\n" +
    "禁区：代替叙事描写——失控值应该伴随着叙事内容，不能只当一个数字槽。",
  parameters: Type.Object({
    actorId: Type.String({ description: "目标 actorId" }),
    delta: Type.Integer({
      description: "失控值变化量。正数增加，负数降低。范围 -100 ~ 100，引擎会自动钳制。",
    }),
    reason: Type.String({ description: "失控值变化的叙事原因" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    updateCorruptionTool(params, ctx.sessionManager),
};

// ===========================================================================
// 工具函数
// ===========================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
