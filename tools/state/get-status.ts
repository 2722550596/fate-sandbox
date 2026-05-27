import { cloneState } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function getStatusTool(): ToolResult {
  const state = cloneState();
  const text = [
    `💰 持有金钱: ${state.金钱.toLocaleString()} 円`,
    `📍 当前位置: ${state.当前位置}`,
    `💪 身体状态: ${state.身体状态}%`,
    `⏱️ 当前时间: ${state.当前时间}`,
    `🕰️ 经过分钟: ${state.经过分钟}`,
    `💤 疲劳: ${state.疲劳}%`,
    `🔮 魔力负担: ${state.魔力负担}%`,
    `⚠️ 危险度: ${state.危险度}/5`,
    `🕯️ 神秘暴露: ${state.神秘暴露}%`,
    `👁️ 社会暴露: ${state.社会暴露}%`,
    `🗡️ 敌方警觉: ${state.敌方警觉}%`,
  ].join("\n");
  return textResult(text);
}
