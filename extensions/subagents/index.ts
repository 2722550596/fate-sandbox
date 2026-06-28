import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { Type } from "typebox";

export { buildTimelineStateContextFromRaw as buildTimelineStateContext } from "../../engine/core/state/state-file-projection.ts";
import { lookupTool } from "../../engine/tools/lookup/lookup-rag.ts";
import { lookupNovelToolDefinition } from "../../engine/tools/lookup/novel-lookup.ts";

/**
 * subagent 运行时 extension：为子代理注册所需工具。
 *
 * 目前提供：
 *   - lookup：查询诡秘之主世界的权威设定（timeline-showrunner 使用）
 *   - lookup_novel：查询原著章节内容（novel-analyst 使用）
 */
export default function subagentsExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "lookup",
    label: "lookup",
    description:
      "查询诡秘之主世界的权威设定。仅用于 subagent 核对当前世界线相关公开设定；不要用它读取或修改 canonical state。",
    parameters: Type.Object({
      query: Type.String({
        description: "搜索关键词——角色名、地点名、概念名等；多关键词用空格分隔，不要写整句。",
      }),
    }),
    execute: async (_toolCallId, params) => lookupTool(params),
  });

  pi.registerTool({
    name: lookupNovelToolDefinition.name,
    label: lookupNovelToolDefinition.name,
    description: lookupNovelToolDefinition.description,
    parameters: lookupNovelToolDefinition.parameters,
    execute: lookupNovelToolDefinition.execute,
  });
}
