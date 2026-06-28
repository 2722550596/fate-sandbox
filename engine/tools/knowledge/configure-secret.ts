import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { parseConfigureSecretInput } from "../../core/knowledge/secrets-schema.ts";
import { configureSecret } from "../../core/knowledge/secrets.ts";
import { runDomainEventTool } from "../system/domain-tool-runner.ts";

export function configureSecretTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      configureSecret(draft, parseConfigureSecretInput(params, "configure_secret 参数")),
    details: (result) => ({ result }),
    message: (result) => result.message,
  });
}

export const configureSecretToolDefinition: DomainToolDefinition = {
  name: "configure_secret",
  description:
    "配置隐藏秘密（actor 级或世界级）。只写入 secrets 数据，不改变 public 状态。\n\n" +
    "【使用边界】\n" +
    "- actor-beyonder：对 actor 配置非凡力量相关的隐藏秘密（能力秘密、途径知识、扮演体悟等）\n" +
    "- actor-private：对 actor 配置私人动机、未公开关联等非超凡秘密\n" +
    "- world-fact：配置世界/战役级隐藏事实（源质本质、末日预言等世界观秘密）\n\n" +
    "同一 text/value 重复调用会合并 revealConditions（upsert 语义）。\n\n" +
    "【禁区】\n" +
    "- 在揭示后追加证据（用 reveal_secret）\n" +
    "- 配置玩家已知的公开信息",
  parameters: Type.Object({
    kind: Type.String({
      description:
        "actor-beyonder（非凡力量秘密）/ actor-private（个人秘密）/ world-fact（世界观秘密）",
    }),
    actorId: Type.Optional(
      Type.String({
        description:
          "目标 actor id（actor-beyonder / actor-private 必填）；必须已存在于 public actors",
      }),
    ),
    secrets: Type.Optional(
      Type.Array(
        Type.Object({
          value: Type.String({ description: "秘密内容（自由文本）" }),
          revealConditions: Type.Array(
            Type.String({ description: "可被 claim/trigger 命中的短线索词" }),
          ),
        }),
        {
          description: "secret 列表（actor-beyonder / actor-private 必填）",
        },
      ),
    ),
    text: Type.Optional(
      Type.String({
        description: "世界隐藏事实内容（world-fact 必填）",
      }),
    ),
    revealConditions: Type.Optional(
      Type.Array(Type.String(), {
        description: "可被 claim/trigger 命中的短线索词（world-fact 必填）",
      }),
    ),
    relatedActorIds: Type.Optional(
      Type.Array(Type.String(), {
        description: "关联 actor id（world-fact）；留空则仅主角相关",
      }),
    ),
    reason: Type.String({ description: "配置原因" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    configureSecretTool(params, ctx.sessionManager),
};
