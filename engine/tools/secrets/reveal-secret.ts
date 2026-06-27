import type {
  ConfigureActorSecretsResult,
  ConfigureSequenceSecretsResult,
  RevealSecretResult,
  RevealSecretToolInput,
} from "../../core/knowledge/secrets.ts";
import type { State } from "../../core/state/state.ts";
import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { parseRevealSecretToolInput } from "../../core/knowledge/secrets-schema.ts";
import {
  configureActorSecrets,
  configureSequenceSecrets,
  revealSecret,
} from "../../core/knowledge/secrets.ts";
import { runDomainEventTool } from "../system/domain-tool-runner.ts";

type RevealSecretToolResult =
  | { kind: "configure"; result: ConfigureActorSecretsResult | ConfigureSequenceSecretsResult }
  | { kind: "reveal"; result: RevealSecretResult };

export function revealSecretTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      executeSecretTool(draft, parseRevealSecretToolInput(params, "reveal_secret 参数")),
    details: secretDetails,
    message: secretMessage,
  });
}

function executeSecretTool(draft: State, input: RevealSecretToolInput): RevealSecretToolResult {
  if (input.kind === "configure-sequence-secrets") {
    return { kind: "configure", result: configureSequenceSecrets(draft, input) };
  }
  if (input.kind === "configure-actor-secrets") {
    return { kind: "configure", result: configureActorSecrets(draft, input) };
  }
  return { kind: "reveal", result: revealSecret(draft, input) };
}

function secretDetails(output: RevealSecretToolResult): Record<string, unknown> {
  if (output.kind === "configure") {
    return { result: output.result };
  }
  return { outcome: output.result.outcome };
}

function secretMessage(output: RevealSecretToolResult): string {
  if (output.kind === "configure") {
    return output.result.message;
  }
  return output.result.playerSafeMessage;
}

export const revealSecretToolDefinition: FateToolDefinition = {
  name: "reveal_secret",
  description:
    "配置或揭示 hidden-canonical secret。配置模式只写 secrets；揭示模式只在玩家可见证据成立时更新 public。\n\n" +
    "【使用边界】\n" +
    "- 首次建立非凡者或重要 NPC 的隐藏途径/序列秘密时，用 configure-sequence-secrets 写入 secret slot\n" +
    "- 玩家提出途径/序列/隐藏身份 claim，或场内触发揭示条件时，用 claim-reveal / observed-reveal\n" +
    "- revealConditions 必须是之后 claim/trigger/evidence 能字面命中的短线索词\n\n" +
    "禁区：\n" +
    "- 重复配置相同 secret\n" +
    "- 列出 secret slots 或幕后真相\n" +
    "- 证据不足时泄露正确答案",
  parameters: Type.Object({
    kind: Type.String({
      description:
        "claim-reveal / observed-reveal / configure-sequence-secrets / configure-actor-secrets",
    }),
    actorId: Type.String({ description: "要揭示秘密的 actor id；必须已存在于 public actors" }),
    claim: Type.Optional(Type.String()),
    trigger: Type.Optional(Type.String()),
    evidence: Type.Optional(Type.String()),
    pathwaySecret: Type.Optional(
      Type.Object({
        value: Type.String({ description: "隐藏途径" }),
        revealConditions: Type.Array(
          Type.String({ description: "可被 claim/trigger/evidence 命中的短线索词" }),
        ),
      }),
    ),
    sequenceSecret: Type.Optional(
      Type.Object({
        value: Type.String({ description: "隐藏序列" }),
        revealConditions: Type.Array(
          Type.String({ description: "可被 claim/trigger/evidence 命中的短线索词" }),
        ),
      }),
    ),
    privateMotives: Type.Optional(
      Type.Array(
        Type.Object({
          value: Type.String({ description: "NPC 隐藏动机" }),
          revealConditions: Type.Array(
            Type.String({ description: "可被 claim/trigger/evidence 命中的短线索词" }),
          ),
        }),
      ),
    ),
    unrevealedAffiliations: Type.Optional(
      Type.Array(
        Type.Object({
          value: Type.String({ description: "NPC 未公开隶属/身份" }),
          revealConditions: Type.Array(
            Type.String({ description: "可被 claim/trigger/evidence 命中的短线索词" }),
          ),
        }),
      ),
    ),
    reason: Type.Optional(Type.String()),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    revealSecretTool(params, ctx.sessionManager),
};
