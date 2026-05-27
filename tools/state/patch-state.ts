import { getState, patchState, writeStateToDetails, cloneState, type PatchOp } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export interface PatchStateParams {
  ops: ReadonlyArray<PatchOp>;
}

export function patchStateTool(params: PatchStateParams): ToolResult {
  const before = cloneState();
  patchState(params.ops);
  const after = getState();

  const opsDesc = params.ops.map((op) => `${op.op} ${op.path}`).join(", ");
  const text = [
    `状态已更新 (${opsDesc})`,
    `💰 金钱: ${before.金钱.toLocaleString()} → ${after.金钱.toLocaleString()} 円`,
    `📍 位置: ${before.当前位置} → ${after.当前位置}`,
    `💪 身体: ${before.身体状态}% → ${after.身体状态}%`,
    `⏱️ 当前时间: ${before.当前时间} → ${after.当前时间}`,
    `🕰️ 经过分钟: ${before.经过分钟} → ${after.经过分钟}`,
    `💤 疲劳: ${before.疲劳}% → ${after.疲劳}%`,
    `🔮 魔力负担: ${before.魔力负担}% → ${after.魔力负担}%`,
    `⚠️ 危险度: ${before.危险度}/5 → ${after.危险度}/5`,
    `🕯️ 神秘暴露: ${before.神秘暴露}% → ${after.神秘暴露}%`,
    `👁️ 社会暴露: ${before.社会暴露}% → ${after.社会暴露}%`,
    `🗡️ 敌方警觉: ${before.敌方警觉}% → ${after.敌方警觉}%`,
  ].join("\n");

  const details: Record<string, unknown> = {};
  writeStateToDetails(details);
  return textResult(text, details);
}
