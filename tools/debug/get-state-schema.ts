import { CURRENT_STATE_SCHEMA_VERSION, allowedPatchPaths } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function getStateSchemaTool(): ToolResult {
  const schema = {
    版本: CURRENT_STATE_SCHEMA_VERSION,
    字段: {
      金钱: "number — 日元余额，不能为负",
      当前位置: "string — 如 冬木市·深山镇·卫宫邸",
      身体状态: "number — 0-100, 100=健康, 0=死亡",
      当前时间: "ISO date string — 游戏内时间锚点",
      经过分钟: "number — 从开局累计经过的分钟数",
      疲劳: "number — 0-100, 行动负荷与注意力下降",
      魔力负担: "number — 0-100, 魔术/供魔/神秘接触成本",
      危险度: "number — 0-5, 当前场景危险等级",
    },
    受保护路径: allowedPatchPaths(),
    仅允许: "patch_state 只能修改受保护路径；风险/耗时/疲劳/魔力负担优先用 resolve_consequence 结算",
  };
  return textResult(JSON.stringify(schema, null, 2));
}
