import type { DomainToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { parseRevealSecretInput } from "../../core/knowledge/secrets-schema.ts";
import { revealSecret } from "../../core/knowledge/secrets.ts";
import { runDomainEventTool } from "../system/domain-tool-runner.ts";

function formatResult(
  result: import("../../core/knowledge/secrets.ts").RevealSecretResult,
): string {
  const bands: Record<string, string> = {
    revealed: "完全揭示",
    foreshadowed: "预感/暗示",
    "insufficient-evidence": "证据不足",
    incorrect: "错误",
  };
  const label = bands[result.outcome] ?? result.outcome;
  return [`揭示结果：${label}`, ...result.narrativeConstraints.map((c) => `  - ${c}`)].join("\n");
}

export const revealSecretToolDefinition: DomainToolDefinition = {
  name: "reveal_secret",
  description:
    "根据玩家 claim 或 GM 观察尝试揭示隐藏秘密。只检查 evidence 匹配并更新 revealState。\n\n" +
    "【使用边界】\n" +
    "- claim-reveal：玩家主动声称某事为真（claim），GM 提供匹配证据\n" +
    "- observed-reveal：GM 认为场景中发生的事足以触发秘密揭示\n\n" +
    "【禁区】\n" +
    "- 配置新的隐藏秘密（用 configure_secret）\n" +
    "- 查询未揭示秘密的完整内容（用 private_resolve）",
  parameters: Type.Object({
    kind: Type.String({ description: "claim-reveal（玩家声称）/ observed-reveal（GM 观察）" }),
    actorId: Type.String({ description: "目标 actor id；必须已存在于 public actors" }),
    claim: Type.Optional(
      Type.String({
        description: "玩家声称的内容（claim-reveal 必填）",
      }),
    ),
    trigger: Type.Optional(
      Type.String({
        description: "GM 观察到的触发现象（observed-reveal 必填）",
      }),
    ),
    evidence: Type.String({ description: "匹配证据，必须包含 revealConditions 中的关键词" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
    return runDomainEventTool({
      sessionManager: ctx.sessionManager,
      execute: (draft) => revealSecret(draft, parseRevealSecretInput(params, "reveal_secret 参数")),
      details: (result) => ({ outcome: result.outcome }),
      message: (result) => formatResult(result),
    });
  },
};
