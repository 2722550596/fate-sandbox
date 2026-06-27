import { isRecord } from "../core/utils/typebox-validation.ts";

/**
 * 结算器（Pass A）漏稿源头收口。
 *
 * 两段式契约下，结算回合的 assistant 消息只应携带工具调用（含
 * `submit_direction_packet`）；玩家可见叙事一律走 packet → 渲染器（Pass B）。
 * 但模型有时会在工具调用旁边漏出正文（TextContent）——这段正文玩家从未看到
 * （他们看到的是 Pass B 渲染版，可能不一致），却会随 assistant 消息落入 session
 * 历史，被后续结算轮次反复回喂，让结算器把「没渲染过的自说自话」当成既定事实，
 * 与 canonical prose 分叉，还白白撑大上下文。
 *
 * `extension.ts` 的 context 过滤只认 `fsn-prose` custom message（渲染器产物），
 * 认不出结算器自己的裸文本。本函数在 `message_end` 钩子里补上这道闸：把「含
 * ≥1 toolCall 的 assistant 消息」中的 `text` 部件剥掉，保留 thinking 与 toolCall
 * 部件，从源头杜绝漏稿入史。
 *
 * 设计边界：
 * - 只处理含 ≥1 toolCall 的 assistant 消息。纯文本回合（没提交 packet 的元话轮 /
 *   异常路径）是玩家可见回复，必须保留——既不能清空成非法消息，也不该吞掉。
 * - 渲染器 Pass B 走裸 `stream()`，不经 agent 消息管线，本钩子不会触发，无需额外判别。
 * - 返回 `undefined` 表示不改动（让钩子原样放行）。
 */
export function stripLeakedSettlementProse<T>(message: T): T | undefined {
  if (!isRecord(message) || message["role"] !== "assistant") {
    return undefined;
  }
  const content = message["content"];
  if (!Array.isArray(content)) {
    return undefined;
  }
  const hasToolCall = content.some((part) => isPartOfType(part, "toolCall"));
  if (!hasToolCall) {
    return undefined;
  }
  const hasText = content.some((part) => isPartOfType(part, "text"));
  if (!hasText) {
    return undefined;
  }
  const kept = content.filter((part) => !isPartOfType(part, "text"));
  return { ...message, content: kept };
}

function isPartOfType(part: unknown, type: string): boolean {
  return isRecord(part) && part["type"] === type;
}
