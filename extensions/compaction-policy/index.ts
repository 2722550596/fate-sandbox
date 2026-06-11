import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { syncStateFromSessionManager } from "../../engine/core/session-hydration.ts";
import { buildStateExclusionDigestFromRaw } from "../../engine/core/state-file-projection.ts";
import { exportState } from "../../engine/core/state-store.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const POLICY_PATH = join(PROJECT_ROOT, "agents", "compaction-policy.md");

export default function compactionPolicyExtension(pi: ExtensionAPI): void {
  pi.registerCommand("fate-compact", {
    description: "Compact chat memory with Fate sandbox state exclusion reference",
    handler: async (_args, ctx) => {
      triggerFsnCompaction(ctx);
    },
  });
}

function triggerFsnCompaction(ctx: ExtensionContext): void {
  if (ctx.hasUI) {
    ctx.ui.notify("Fate compaction started", "info");
  }
  ctx.compact({
    customInstructions: buildCustomInstructions(ctx),
    onComplete: () => {
      if (ctx.hasUI) {
        ctx.ui.notify("Fate compaction completed", "info");
      }
    },
    onError: (error) => {
      if (ctx.hasUI) {
        ctx.ui.notify(`Fate compaction failed: ${error.message}`, "error");
      }
    },
  });
}

function buildCustomInstructions(ctx: ExtensionContext): string {
  const sections = [
    readFileSync(POLICY_PATH, "utf-8").trim(),
    "",
    "<current_state_for_exclusion>",
    JSON.stringify(readStateExclusionDigest(ctx), null, 2),
    "</current_state_for_exclusion>",
  ];
  const previousSummary = readPreviousCompactionSummary(ctx);
  if (previousSummary !== undefined) {
    sections.push(
      "",
      "<previous_compaction_summary_for_exclusion>",
      previousSummary,
      "</previous_compaction_summary_for_exclusion>",
    );
  }
  return sections.join("\n");
}

/**
 * 从当前 session branch 里找最近一次 compaction 的摘要，
 * 作为增量压缩的排除参照（已记录内容只输出 delta）。
 */
function readPreviousCompactionSummary(ctx: ExtensionContext): string | undefined {
  try {
    const branch = ctx.sessionManager.getBranch();
    for (let i = branch.length - 1; i >= 0; i--) {
      const entry = branch[i];
      if (entry?.type === "compaction" && entry.summary.trim() !== "") {
        return entry.summary.trim();
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * 从当前 session branch 同步进程内 canonical state 后直接取快照；
 * 不再读 state/state.json 侧通道，避免拿到别的 session/branch 的残留快照。
 */
function readStateExclusionDigest(
  ctx: ExtensionContext,
): ReturnType<typeof buildStateExclusionDigestFromRaw> | { error: string } {
  try {
    syncStateFromSessionManager(ctx.sessionManager);
    return buildStateExclusionDigestFromRaw(exportState());
  } catch (error) {
    return { error: formatError(error) };
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (!existsSync(POLICY_PATH)) {
  throw new Error(`Missing compaction policy: ${POLICY_PATH}`);
}
