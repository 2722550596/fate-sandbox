import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type {
  ConfigureActorSecretsResult,
  ConfigureServantSecretsResult,
  RevealSecretResult,
  RevealSecretToolInput,
} from "../../engine/core/secrets.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import {
  configureActorSecrets,
  configureServantSecrets,
  revealSecret,
} from "../../engine/core/secrets.ts";
import type { State } from "../../engine/core/state.ts";
import { parseRevealSecretToolInput } from "../../engine/core/secrets-schema.ts";

import { runDomainEventTool } from "./domain-tool-runner.ts";

type RevealSecretToolResult =
  | { kind: "configure"; result: ConfigureActorSecretsResult | ConfigureServantSecretsResult }
  | { kind: "reveal"; result: RevealSecretResult };

export function revealSecretTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => executeSecretTool(draft, parseRevealSecretToolInput(params, "reveal_secret 参数")),
    details: secretDetails,
    message: secretMessage,
  });
}

function executeSecretTool(draft: State, input: RevealSecretToolInput): RevealSecretToolResult {
  if (input.kind === "configure-servant-secrets") {
    return { kind: "configure", result: configureServantSecrets(draft, input) };
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

export const revealSecretToolDefinition: FsnToolDefinition = {
  name: "reveal_secret",
  description:
    "根据玩家可见 claim/evidence 尝试揭示隐藏事实；或在 actor 首次入场时配置 secret slots。\n\n" +
    "【必须调用的场景】\n" +
    "- 从者首次入场且使用 upsert_actor(kind=upsert-servant) 后：调用 kind=configure-servant-secrets 写入真名/隐藏宝具揭示条件\n" +
    "- 重要非从者 NPC 首次入场且后续 private_resolve 需要隐藏反应时：调用 kind=configure-actor-secrets 写入 privateMotives/unrevealedAffiliations\n" +
    "- 玩家推理真名、宝具、隐藏身份或触发公开揭示条件\n" +
    "- GM 准备把 foreshadowed 线索升级为已揭示事实\n\n" +
    "【严禁的行为】\n" +
    "- 对同一从者反复配置相同 secret；首次入场配置一次，后续只追加新隐藏宝具\n" +
    "- 要求列出 secret slots 或幕后真相\n" +
    "- 证据不足时泄露正确答案",
  parameters: Type.Object({
    kind: Type.String({
      description:
        "允许: claim-reveal / observed-reveal / configure-servant-secrets / configure-actor-secrets",
    }),
    actorId: Type.String(),
    claim: Type.Optional(Type.String()),
    trigger: Type.Optional(Type.String()),
    evidence: Type.Optional(Type.String()),
    trueName: Type.Optional(
      Type.Object({
        value: Type.String({ description: "隐藏真名，如 美狄亚" }),
        revealConditions: Type.Array(
          Type.String({ description: "玩家证据里出现任一关键词即可触发，如 科尔基斯" }),
        ),
      }),
    ),
    hiddenNoblePhantasms: Type.Optional(
      Type.Array(
        Type.Object({
          value: Type.Object({
            name: Type.String(),
            rank: Type.String({ description: "Fate rank；非真正宝具/无宝具可填 none" }),
            kind: Type.String({ description: "宝具类型，如 对魔术宝具" }),
            status: Type.String({
              description: "隐藏宝具状态，允许: hidden / suspected / revealed",
            }),
            summary: Type.String(),
          }),
          revealConditions: Type.Array(Type.String()),
        }),
      ),
    ),
    privateMotives: Type.Optional(
      Type.Array(
        Type.Object({
          value: Type.String({ description: "NPC 隐藏动机；不会直接公开给玩家" }),
          revealConditions: Type.Array(Type.String()),
        }),
      ),
    ),
    unrevealedAffiliations: Type.Optional(
      Type.Array(
        Type.Object({
          value: Type.String({ description: "NPC 未公开隶属/身份；不会直接公开给玩家" }),
          revealConditions: Type.Array(Type.String()),
        }),
      ),
    ),
    reason: Type.Optional(Type.String()),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    revealSecretTool(params, ctx.sessionManager),
};
