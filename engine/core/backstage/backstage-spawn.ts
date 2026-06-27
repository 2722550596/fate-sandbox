/**
 * Backstage director spawn (engine-direct async substrate — see ADR 0005).
 *
 * `run_parallel_line` fires the hermetic backstage director ITSELF — a detached
 * `pi -p` child — instead of handing the GM a spawn instruction. One GM tool call
 * launches the async line; the main agent loop is not in the middle. No subagent
 * framework is involved: the engine forks `pi -p` via node:child_process, which is
 * all slice A needs (the surveyed frameworks were ruled out in ADR 0005). The
 * persistent / swarm / coordination growth path is a few lines on this same seam.
 *
 * Firewall: --no-tools (zero tools) + --no-approve (no project extension loaded)
 * + its own session under the gitignored .pi/agent/backstage-sessions. The child
 * is fed privateFacts by design; the GM reviews the harvested candidate before
 * landing. The child cannot read or write canonical state.
 */

import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { join } from "node:path";

import { BACKSTAGE_MODEL, BACKSTAGE_SESSION_DIR } from "./backstage-substrate-config.ts";

export interface BackstageDirectorHandle {
  runId: string;
  pid: number | undefined;
  model: string;
  sessionDir: string;
}

/** Pure: the argv for the hermetic detached `pi -p` director child (prompt is last). */
export function buildDirectorSpawnArgs(prompt: string, runId: string): string[] {
  return [
    "-p",
    "--no-tools",
    "--no-approve",
    "--no-context-files",
    "--model",
    BACKSTAGE_MODEL,
    "--session-dir",
    BACKSTAGE_SESSION_DIR,
    "--session-id",
    runId,
    prompt,
  ];
}

type DirectorSpawner = (prompt: string, runId: string) => BackstageDirectorHandle;

const defaultSpawner: DirectorSpawner = (prompt, runId) => {
  // Ensure the durable (gitignored) session dir exists, and capture the child's
  // stdout/stderr to a per-run log so a failed launch is diagnosable (the candidate
  // itself is read from the session jsonl, not stdout).
  mkdirSync(BACKSTAGE_SESSION_DIR, { recursive: true });
  const logFd = openSync(join(BACKSTAGE_SESSION_DIR, `${runId}.spawn.log`), "a");
  const child = spawn("pi", buildDirectorSpawnArgs(prompt, runId), {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    cwd: process.cwd(),
    env: process.env,
  });
  child.unref();
  return { runId, pid: child.pid, model: BACKSTAGE_MODEL, sessionDir: BACKSTAGE_SESSION_DIR };
};

let spawner: DirectorSpawner = defaultSpawner;

/** Test seam: replace the real detached spawn with a fake (null restores default). */
export function setBackstageDirectorSpawnerForTest(fn: DirectorSpawner | null): void {
  spawner = fn ?? defaultSpawner;
}

/** Fire the hermetic backstage director as a detached async child; returns at once. */
export function spawnBackstageDirector(prompt: string, runId: string): BackstageDirectorHandle {
  return spawner(prompt, runId);
}
