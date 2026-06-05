import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface StateExclusionDigest {
  clock: {
    currentAt: string;
    timezone: string;
    displayTime: string;
  };
  campaign: {
    title: string;
    timeline: string;
    premise: string;
  };
  scene: {
    location: string;
    situation: string;
    presentActorIds: string[];
    objectiveIds: string[];
    threatIds: string[];
  };
  actorIds: string[];
  offscreenEventIds: string[];
}

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

function readStateExclusionDigest(): StateExclusionDigest | { error: string } {
  try {
    const raw: unknown = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
    const state = selectStateRecord(raw);
    const publicState = requireRecord(state["public"], "state.public");
    const secrets = requireRecord(state["secrets"], "state.secrets");
    const campaign = requireRecord(publicState["campaign"], "public.campaign");
    const clock = requireRecord(publicState["clock"], "public.clock");
    const scene = requireRecord(publicState["scene"], "public.scene");
    const actors = requireRecord(publicState["actors"], "public.actors");
    return {
      clock: {
        currentAt: requireString(clock["currentAt"], "clock.currentAt"),
        timezone: requireString(clock["timezone"], "clock.timezone"),
        displayTime:
          optionalString(clock["displayTime"]) ??
          requireString(clock["currentAt"], "clock.currentAt"),
      },
      campaign: {
        title: requireString(campaign["title"], "campaign.title"),
        timeline: requireString(campaign["timeline"], "campaign.timeline"),
        premise: requireString(campaign["premise"], "campaign.premise"),
      },
      scene: {
        location: formatLocation(requireRecord(scene["location"], "scene.location")),
        situation: requireString(scene["situation"], "scene.situation"),
        presentActorIds: stringArray(scene["presentActorIds"], "scene.presentActorIds"),
        objectiveIds: objectIdArray(optionalArray(scene["objectives"]), "scene.objectives"),
        threatIds: objectIdArray(optionalArray(scene["threats"]), "scene.threats"),
      },
      actorIds: Object.keys(actors),
      offscreenEventIds: objectIdArray(
        optionalArray(secrets["offscreenEventLog"]),
        "offscreenEventLog",
      ),
    };
  } catch (error) {
    return { error: formatError(error) };
  }
}

function selectStateRecord(raw: unknown): Record<string, unknown> {
  const root = requireRecord(raw, "state root");
  const nestedState = optionalRecord(root["state"]);
  return nestedState ?? root;
}

function formatLocation(location: Record<string, unknown>): string {
  return ["region", "site", "detail"]
    .map((key) => optionalString(location[key]))
    .filter((part) => part !== undefined && part.length > 0)
    .join(" · ");
}

function objectIdArray(values: readonly unknown[], fieldName: string): string[] {
  return values.map((value, index) => {
    const record = requireRecord(value, `${fieldName}[${index}]`);
    return requireString(record["id"], `${fieldName}[${index}].id`);
  });
}

function requireRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
  return value;
}

function optionalRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be a string array.`);
  }
  return value.map((entry) => requireString(entry, `${fieldName}[]`));
}

function optionalArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (!existsSync(POLICY_PATH)) {
  throw new Error(`Missing compaction policy: ${POLICY_PATH}`);
}
