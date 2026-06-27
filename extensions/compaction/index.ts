import type {
  ExtensionAPI,
  ExtensionContext,
  SessionBeforeCompactEvent,
} from "@earendil-works/pi-coding-agent";

import { buildSettlementCompactionSummary } from "../../engine/direction/settlement-compaction.ts";

/**
 * 结算侧 compaction 接管：确定性截断，不调 LLM。
 *
 * 持久事实全在 state（每轮全量注入），渲染侧散文史自管理（two-pass-render
 * 的分层窗口），被压缩的旧对话里唯一值得留的只有事件顺序索引——
 * 从每轮 submit_direction_packet 参数机械提取，零成本、零漂移。
 */
export default function compactionPolicyExtension(pi: ExtensionAPI): void {
  pi.on("session_before_compact", async (event, _ctx) => {
    return runFateCompaction(event);
  });

  pi.on("session_compact", async (event, ctx) => {
    notify(
      ctx,
      event.fromExtension
        ? "Fate compaction completed (deterministic truncation)"
        : "Built-in compaction completed (Fate takeover did not run)",
      event.fromExtension ? "info" : "warning",
    );
  });
}

function runFateCompaction(
  event: SessionBeforeCompactEvent,
): { compaction: { summary: string; firstKeptEntryId: string; tokensBefore: number } } | undefined {
  const {
    messagesToSummarize,
    turnPrefixMessages,
    firstKeptEntryId,
    tokensBefore,
    previousSummary,
  } = event.preparation;
  const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
  if (allMessages.length === 0) {
    return undefined;
  }
  const summary = buildSettlementCompactionSummary(allMessages, previousSummary);
  return { compaction: { summary, firstKeptEntryId, tokensBefore } };
}

function notify(ctx: ExtensionContext, message: string, level: "info" | "warning" | "error"): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
  }
}
