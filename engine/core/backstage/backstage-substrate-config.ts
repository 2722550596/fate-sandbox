/**
 * Backstage substrate config (engine-direct async director — see ADR 0005).
 *
 * Single source for the async faction-director run parameters. `run_parallel_line`
 * forks `pi -p` directly with these (backstage-spawn.ts); the start scripts and
 * docs must match (they cannot import TS, so they hardcode the same values with a
 * pointer back here).
 */

/**
 * Pinned backstage model. Do NOT inherit {current_model}: a backstage director
 * must run on a cheap, known-good model with its own billing, independent of
 * whatever the GM is on (an inherited Opus billing failure was observed in the
 * spike). Matches the model the retired parallel-line agent already pinned.
 */
export const BACKSTAGE_MODEL = "deepseek-v4-pro";

/**
 * Durable session dir for director runs. The game runs under project isolation
 * (start.sh sets PI_CODING_AGENT_DIR=.pi/agent), and `.pi/agent/` is fully
 * gitignored (it already holds auth.json). The director is fed privateFacts
 * (hidden knowledge), so its session holds secrets at rest — keeping it under the
 * gitignored `.pi/agent/` tree means secrets-at-rest never enter the git-tracked
 * source, consistent with where auth.json lives. Resolved relative to the
 * project cwd by the spawned child.
 */
export const BACKSTAGE_SESSION_DIR = ".pi/agent/backstage-sessions";
