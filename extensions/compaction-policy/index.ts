import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildStateExclusionDigestFromRaw } from "../../engine/core/state-file-projection.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const POLICY_PATH = join(PROJECT_ROOT, "agents", "compaction-policy.md");
const STATE_PATH = join(PROJECT_ROOT, "state", "state.json");

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
    customInstructions: buildCustomInstructions(),
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

function buildCustomInstructions(): string {
  return [
    readFileSync(POLICY_PATH, "utf-8").trim(),
    "",
    "<current_state_for_exclusion>",
    JSON.stringify(readStateExclusionDigest(), null, 2),
    "</current_state_for_exclusion>",
  ].join("\n");
}

function readStateExclusionDigest():
  | ReturnType<typeof buildStateExclusionDigestFromRaw>
  | { error: string } {
  try {
    const raw: unknown = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
    return buildStateExclusionDigestFromRaw(raw);
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
