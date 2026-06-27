import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { Type } from "typebox";

export { buildTimelineStateContextFromRaw as buildTimelineStateContext } from "../../../engine/core/state/state-file-projection.ts";
import { lookupTool } from "../../../engine/tools/lookup/lookup.ts";

/**
 * timeline 子代理运行时 extension：只提供 lookup 工具。
 *
 * <timeline_state_context> 不再由本 extension 读 state/state.json 注入——
 * 那是会被测试/别的 session 砸坏的陈旧侧通道。现在由主 GM 进程在 subagent
 * 工具调用发出前，把调用瞬间的投影直接注入 task（见 task-injection.ts），
 * 子代理从输入末尾拿到上下文块。
 */
export default function timelineSubagentsExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "lookup",
    label: "lookup",
    description:
      "查询型月世界的权威设定。仅用于 subagent 核对当前世界线相关公开设定；不要用它读取或修改 canonical state。",
    parameters: Type.Object({
      query: Type.String({
        description: "搜索关键词——角色名、地点名、概念名等；多关键词用空格分隔，不要写整句。",
      }),
    }),
    execute: async (_toolCallId, params) => lookupTool(params),
  });
}
