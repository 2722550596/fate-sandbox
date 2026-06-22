/**
 * Backstage director prompt builder (pi-actors productionization, slice A).
 *
 * The pi-actors faction-director child runs `pi -p --no-tools --no-approve
 * --no-context-files`: zero tools, no project extension, its own empty session.
 * It therefore loads NO agent definition and NO canonical state — its entire
 * world is the single prompt we hand it. This builder assembles that prompt:
 *
 *   1. the backstage persona/contract (BACKSTAGE_DIRECTOR_PERSONA),
 *   2. the subagent-safe `<timeline_state_context>` projection, and
 *   3. the engine-assembled ParallelLineInput (includes privateFacts — the
 *      faction's hidden knowledge it must act on).
 *
 * Firewall posture: the child is fed hidden facts on purpose (that is the whole
 * point of a backstage line). Safety is process isolation + zero tools + its
 * inability to write canon + the GM reviewing the candidate before landing — NOT
 * "the child knows no secret". The child's durable session therefore holds
 * secrets and must live outside the repo (see the spawn instructions / recipe).
 */

import type { State } from "./state.ts";

import { assembleParallelLineInput, type AssembleParallelLineInput } from "./parallel-line-assembler.ts";
import { BACKSTAGE_DIRECTOR_PERSONA } from "./backstage-director-persona.ts";
import { buildTimelineStateContextFromRaw } from "./state-file-projection.ts";

const CONTEXT_OPEN_TAG = "<timeline_state_context>";
const CONTEXT_CLOSE_TAG = "</timeline_state_context>";

/**
 * Build the subagent-safe `<timeline_state_context>` block from canonical state.
 * Mirrors the wording the legacy in-process injection used so the contract the
 * persona references is identical, but is built here from the parsed State.
 */
export function buildBackstageContextBlock(state: State): string {
  const context = buildTimelineStateContextFromRaw(state);
  return [
    CONTEXT_OPEN_TAG,
    "This is the subagent-safe summary of current canonical state. It contains NO secrets and NO hidden knowledge; do not ask the main GM to repeat it and do not write it verbatim to the player.",
    "Check recentOffscreenEvents and pressurePalette.coolingDown first: avoid repeating the same actor/faction/pressureType; if the same pressure type was just used, prefer another ecological slot for this timeline or return no-change/blocked.",
    "actor.agenda / actor.knowledgeLens are the NPC autonomy and knowledge-boundary ledgers; relationshipSignals is the relationship-evidence ledger. Use them for autonomy and relationship costs, but never write hidden knowledge or secret signals verbatim as player-visible text.",
    "All output timeRange.start/end must be ISO UTC strings; displayTime is local-only — never treat the local clock as UTC. timeRange.end must not be later than currentAt.",
    JSON.stringify(context, null, 2),
    CONTEXT_CLOSE_TAG,
  ].join("\n");
}

/**
 * Compose the full, self-contained hermetic director prompt: persona + safe
 * projection + assembled ParallelLineInput + the final output instruction.
 */
export function buildBackstageDirectorPrompt(
  state: State,
  input: AssembleParallelLineInput,
): string {
  const assembled = assembleParallelLineInput(state, input);
  return [
    BACKSTAGE_DIRECTOR_PERSONA,
    "",
    buildBackstageContextBlock(state),
    "",
    "ParallelLineInput:",
    JSON.stringify(assembled, null, 2),
    "",
    "Return the ParallelLineOutput JSON now. Output ONLY the bare JSON object: first character `{`, last character `}`, no Markdown, no code fence, no prose.",
  ].join("\n");
}
