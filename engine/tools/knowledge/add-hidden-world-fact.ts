import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { parseAddHiddenWorldFactInput } from "../../core/knowledge/secrets-schema.ts";
import { configureHiddenWorldFact } from "../../core/knowledge/secrets.ts";
import { runDomainEventTool } from "../system/domain-tool-runner.ts";

export function addHiddenWorldFactTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      configureHiddenWorldFact(
        draft,
        parseAddHiddenWorldFactInput(params, "add_hidden_world_fact 参数"),
      ),
    details: (result) => ({ result }),
    message: (result) => result.message,
  });
}

export const addHiddenWorldFactToolDefinition: DomainToolDefinition = {
  name: "add_hidden_world_fact",
  description:
    "记录一条世界/战役级隐藏事实。这些事实不属于特定 actor，而是世界观层面的秘密（如源质本质、末日预言等）。\n\n" +
    "【使用边界】\n" +
    "- 首次建立重大世界观秘密时记录\n" +
    "- 同一 text 重复调用会合并 revealConditions（upsert 语义）\n" +
    "- revealConditions 是 claim-reveal / observed-reveal 时 evidence 匹配的关键词\n" +
    "- relatedActorIds 留空时仅主角可揭示；填写后关联 actor 也可揭示\n\n" +
    "禁区：\n" +
    "- 对属于特定 actor 的秘密用 configure-sequence-secrets / configure-actor-secrets\n" +
    "- 记录玩家已知的公开信息",
  parameters: Type.Object({
    text: Type.String({ description: "世界隐藏事实内容" }),
    revealConditions: Type.Array(Type.String(), {
      description: "可被 claim/trigger/evidence 命中的短线索词",
    }),
    relatedActorIds: Type.Array(Type.String(), {
      description: "关联 actor id；留空则仅主角相关",
    }),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    addHiddenWorldFactTool(params, ctx.sessionManager),
};
