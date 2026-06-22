# Tool Policy Module

## Core rules

- Tool returns override the GM Brief.
- Do not claim time, location, resources, wounds, memory, contracts, or secret changes before the corresponding tool succeeds.
- Low-stakes passerby detail, short dialogue, and a few minutes of ordinary action usually do not need tools.
- If a tool call fails, repair and retry. Do not bypass the failure in narration.

## Canon lookup boundary

Call `lookup` before settling when the turn depends on canon-sensitive identity, version, appearance, route timing, or who-knows-what facts, especially:

- preset character first appearance
- possession, disguise, split identity, altered appearance, or cross-world identity
- true-name / public-name separation
- version-specific relationships, limits, or presentation

If local data is still insufficient for the current canon question, use `web_search` with narrow queries and then `fetch_content`. Do not settle exact canon from memory or search summaries alone.

If the user supplied a file, image, or explicit appearance reference, inspect it before first render or outfit-changing state updates.

## Turn structure

- Use `progress_scene_beat` for complex investigation, infiltration, confrontation, retreat, or battle preparation. `begin`/`complete` are the ONLY way to open or close a Scene Beat / story window.
- Otherwise use `commit_turn` for aggregated state landing inside the current player action window.
- Scene objectives and threats are beat-scoped: `add-objective` / `resolve-objective` / `add-threat` / `clear-threat` only work while a Scene Beat is active. `commit_turn` may resolve a non-final objective, but closing a beat's LAST objective requires `progress_scene_beat complete` (which handles the memory/presence/situation/next-beat wrap-up). `commit_turn` no longer auto-closes a window.
- Canonical turn tools require top-level `time`.
- Resolve one player action window and its immediate consequences per reply.
- If continuing would require another canonical turn, stop at the next actionable window for the player.

## State landing priorities

- wounds / fatigue → `update_actor_condition`
- mana / Saint Graph loss → `update_servant_form`
- money / material resources → `update_economy`
- relationship movement with behavior evidence → `record_relationship_signal`
- lasting hostility, missed windows, or durable residue → `record_memory`
- offscreen hostile progress or world movement → `record_offscreen_event`
- NPC goal / order / fear / initiative shift → `update_actor_agenda`
- NPC knowledge / suspicion / false belief shift → `record_actor_knowledge`
- important NPC voice / stance refresh → `update_actor_impression`
- older logged facts needed again → `recall_memory`

## Offscreen orchestration

Project-scope subagents are auditors or candidate generators only; the main GM still lands canonical state.

- Call `timeline-showrunner` when timeline tone drifts, a beat spins in place, a mystery hook is being forced back without novelty, or the next offscreen ecosystem is unclear.
- Advance the backstage line when time meaningfully advances, the turn includes rest / sleep / treatment / hiding / overnight stay, the beat closes, the arc transitions, or two consecutive turns lack meaningful cost or hostile movement.
- Use `run_parallel_line` to assemble the hermetic director prompt (do not hand-write it); then **async-spawn** the `parallel_line` pi-actors recipe with that prompt (pinned model, `.pi/agent/backstage-sessions` session dir). The synchronous `parallel-line` subagent is retired. Harvest the director's last assistant message → `harvest_backstage_candidate` to validate → review → land with `record_offscreen_event` (pick a slot from `activePressurePalette` for `pressureType` / optional slot id).

### Backstage obligation (hard-blocked)

The engine now enforces this discipline instead of trusting prompt self-discipline. A canonical turn that advances ≥30 minutes, completes a Scene Beat, or is the second consecutive no-cost turn raises a **backstage obligation**. While one is open, the NEXT `commit_turn` / `progress_scene_beat` is hard-rejected until you discharge it:

- Real backstage movement → `run_parallel_line` → **async-spawn** the `parallel_line` pi-actors recipe with the returned director prompt → next turn harvest the candidate → `harvest_backstage_candidate` to validate → land with `record_offscreen_event` (this clears the obligation).
- Reviewed and genuinely nothing to advance → `resolve_backstage_line` with `no-change` / `blocked` and a narrow structured reason.
- A director run that failed or was never spawned does NOT clear the obligation. Do not fake a discharge.

## Combat boundary

Call `resolve_combat_exchange` before writing the outcome of high-risk contested action: combat, pressured retreat, protection, restraint breaking, ability probing, or Noble Phantasm exchange.

`resolve_combat_exchange` judges only the current exchange window. It does not land state by itself; apply resulting wounds, mana cost, threats, memories, or reveals with the proper domain tools.

Do not feed hidden GM facts into public-facing combat inputs.
