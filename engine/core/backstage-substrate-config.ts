/**
 * Backstage substrate config (pi-actors productionization).
 *
 * Single source for the async faction-director run parameters. The GM-facing
 * spawn instructions (run_parallel_line) read these; the recipe file, start
 * scripts, and docs must match (they cannot import TS, so they hardcode the same
 * values with a pointer back here).
 */

/** pi-actors recipe name (installed to ~/.pi/agent/recipes/). Slice A: stateless single-line. */
export const BACKSTAGE_RECIPE = "parallel_line";

/**
 * Pinned backstage model. Do NOT inherit {current_model}: a backstage director
 * must run on a cheap, known-good model with its own billing, independent of
 * whatever the GM is on (an inherited Opus billing failure was observed in the
 * spike). Matches the model the retired parallel-line agent already pinned.
 */
export const BACKSTAGE_MODEL = "deepseek-v4-pro";

/**
 * Durable session dir for director runs. Lives OUTSIDE the repo: the director is
 * fed privateFacts (hidden knowledge), so its session holds secrets at rest.
 * Never under the project tree, never committed.
 */
export const BACKSTAGE_SESSION_DIR = "~/.pi/agent/backstage-sessions";
