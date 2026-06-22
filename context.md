# Code Context

## Files Retrieved

1. `engine/core/turn-commit.ts` (lines 27-150) - canonical turn envelope: applies time, dispatches domain events, checks obligations, appends turn log, warns on pacing/due backstage.
2. `engine/core/scene-beat-lifecycle.ts` (lines 51-150) - Scene Beat begin/complete lifecycle and turn-log integration.
3. `engine/core/offscreen-event.ts` (lines 23-73) - secret offscreen event landing, visibility and completed-time invariants.
4. `engine/core/memory.ts` (lines 28-132) - public memory write path and secret-claim guardrails.
5. `engine/core/secrets.ts` (lines 88-170) - actor/servant secret configuration and reveal path that records public memory after successful reveal.
6. `tools/registry.ts` (lines 40-77) - tool registration order and full public/domain/debug tool surface.
7. `tools/state/run-parallel-line.ts` (lines 1-141) - engine-assembled parallel-line input; subagent call remains a manual two-step workflow.
8. `engine/core/parallel-line-assembler.ts` (lines 1-190) - builds parallel-line input from state, including heuristic recent pressure classification.
9. `extensions/subagents/timeline/task-injection.ts` (lines 15-108) - injects safe state context into timeline subagent tasks.
10. `agents/gm-tool-policy.md` (lines 23-58) - prompt-level routing for turns, state landing, offscreen orchestration, combat boundary.
11. `.pi/agents/parallel-line.md` (full file reviewed) - backstage candidate-generator contract and output constraints.
12. `.pi/agents/timeline-showrunner.md` (full file reviewed) - timeline drift auditor contract and output constraints.

## Key Code

```ts
// engine/core/turn-commit.ts:57-69
export function commitTurn(draft: State, input: TurnCommitInput): TurnCommitResult {
  const summary = assertNonEmptyString(input.summary, "summary");
  const startedAt = draft.public.clock.currentAt;
  const timeResult = applyTurnTime(draft, input.time);
  const results = input.events.map((event) => applyTurnEvent(draft, event));
  assertNoOpenObligations(draft);
  const timeResults = [{ kind: "scene" as const, result: timeResult }];
  const autoCloseResult = closeCompletedOpenStoryWindow(draft);
  ...
  appendTurnLogEntry(draft, { summary, startedAt, endedAt: draft.public.clock.currentAt, ... });
}
```

```ts
// engine/core/memory.ts:90-129
function validateClaims(draft: State, claims: readonly MemoryClaim[] | undefined): void {
  if (claims === undefined || claims.length === 0) throw new Error("record_memory 必须提供 claims...");
  const secretSlots = allActorSecretSlots(draft.secrets);
  for (const claim of claims) validateClaim(claim, secretSlots);
}
...
if (secretSlots.some((slot) => slot.revealState !== "revealed")) {
  throw new Error("公开记忆不能把未揭示 secret 写成 confirmed/observed/inferred claim...");
}
```

```ts
// engine/core/offscreen-event.ts:28-38,48-58
const visibility = assertOffscreenEventVisibility(input.visibility);
if (visibility === "player-known") throw new Error("record_offscreen_event 不能直接写入 player-known...");
...
assertClosedTimeRange(draft, timeRange);
draft.secrets.offscreenEventLog.push({ id: eventId, lineId, actorIds, timeRange, visibility, summary, consequences, futureHooks, createdFrom });
```

```ts
// extensions/subagents/timeline/task-injection.ts:22-31
export function buildTimelineStateContextBlock(rawState: unknown): string {
  const context = buildTimelineStateContextFromRaw(rawState);
  return [
    "<timeline_state_context>",
    "...",
    JSON.stringify(context, null, 2),
    "</timeline_state_context>",
  ].join("\n");
}
```

## Architecture

The runtime is built around deterministic engine mutations plus prompt/tool routing:

- GM prompt modules (`agents/*.md`) define turn policy, information safety, pressure discipline, and when to call tools/subagents. Critical routing is in `agents/gm-tool-policy.md:23-58`.
- Tools in `tools/state/*` are public domain-event boundaries. `tools/registry.ts:40-77` registers normal play tools, lookup, and debug tools in one list.
- `commit_turn` is the canonical non-Scene-Beat turn envelope: time is applied first, then domain events are dispatched, obligations are checked, and `turnLog` is appended (`engine/core/turn-commit.ts`). It no longer embeds scene-beat events nor auto-closes story windows; objectives/threats are beat-scoped and `resolve-objective` refuses to clear a beat's last objective (that requires `progress_scene_beat complete`).
- `progress_scene_beat` is a stricter lifecycle API for begin/complete of foreground action windows. It also applies top-level time and appends turn log (`engine/core/scene-beat-lifecycle.ts:67-129`).
- Public memory is guarded by structured claims. Non-mundane confirmed/observed/inferred claims must either refer only to revealed secret slots or carry auditable evidence (`engine/core/memory.ts:90-129`).
- Secrets are configured in secret slots and only become public through `revealSecret`, which updates public servant identity/NP state and records a public memory event on successful reveal (`engine/core/secrets.ts:125-151`).
- Offscreen events are hidden canonical state in `draft.secrets.offscreenEventLog`; they cannot be `player-known` and cannot end after current time (`engine/core/offscreen-event.ts:23-73`).
- Timeline subagents are candidate/audit workers, not state writers. `run_parallel_line` assembles safe input (`tools/state/run-parallel-line.ts:1-141`); main GM then calls project subagent and lands accepted candidates via `record_offscreen_event`. Context injection appends safe state projections to `parallel-line` and `timeline-showrunner` tasks (`extensions/subagents/timeline/task-injection.ts:15-108`).

## Review Findings

1. **RESOLVED (schema v16) - Offscreen pressure type is now canonical.** `OffscreenEvent` carries a required `pressureType` and optional `pressureSlotId` (`engine/core/parallel-line.ts`), supplied at write time via `record_offscreen_event` (`engine/core/offscreen-event-schema.ts`). The assembler reads the canonical field instead of regex-inferring from summary (`engine/core/parallel-line-assembler.ts`); the old text classifier survives only as a migration/last-resort backfill (`engine/core/offscreen-pressure.ts`), and migration v15→v16 backfills legacy events. This is the prerequisite for the backstage obligation loop (still pending — see below).

2. **RESOLVED (schema v17) - Parallel-line now has a runtime hard-block, not just prompt discipline.** A new `secrets.backstageObligations` ledger (+ `backstageReviewLog`, `backstagePressure`) is driven by triggers evaluated at the tool layer on every canonical turn: ≥30min advance, beat-complete, or 2 consecutive no-cost turns raise an obligation (`engine/core/backstage-obligation.ts`). The next `commit_turn`/`progress_scene_beat` is hard-rejected until discharged via `record_offscreen_event` (outcome=landed) or the new `resolve_backstage_line` tool (no-change/blocked). A pi API investigation confirmed a domain tool CANNOT synchronously invoke a subagent (tool `execute` gets `ExtensionContext` with no agent-spawn surface; the `subagent` capability is itself a model-invoked tool running as a separate process), so the loop deliberately stays as obligation + manual two-step discharge rather than a synchronous one-shot. Subagent failure does not clear the obligation.

3. **RESOLVED (schema v15) - Scene Beat lifecycle is now single-path.** `commit_turn` no longer accepts `scene-beat` events, the `set-story-window`/`clear-story-window` scene events were removed, and `commit_turn` no longer auto-closes story windows. `progress_scene_beat begin/complete` is the sole lifecycle entry. objectives/threats are enforced beat-scoped (`engine/core/scene.ts` `assertActiveStoryWindow`), `resolve-objective` refuses a beat's last objective, and migration v14→v15 folds floating objectives/threats into a public memory event (`engine/core/state-migration.ts`).

4. **Low - Memory can confirm non-mundane facts with free-text evidence but no related secret slot.** `validateClaim` blocks unrevealed related slots and requires evidence when no slots are referenced (`engine/core/memory.ts:121-129`). That is good, but for identity/motive/ability/world-fact claims, free-text evidence may still become a broad escape hatch if the claim should correspond to an existing secret slot. Improvement: for claim kinds that map to actor secrets (`identity`, `motive`, `ability`, `affiliation`), require `relatedSecretSlotIds` when the subject actor has slots of that type, or add tests documenting why evidence-only is allowed.

5. **Low - Debug tools are registered in the same registry as normal GM tools.** `tools/registry.ts:65-70` registers `patch_state`, `override_locked_fact`, `migrate_state`, `reset_state`, and schema debug alongside normal play tools. This may be intentional for local runtime, but it increases prompt/tool-choice exposure. Improvement: consider runtime gating by mode/session flag, or at least separate registry groups if pi supports contextual tool exposure.

## Start Here

The three highest-value runtime-closure improvements are now implemented (Scene Beat single-path, direction-packet semantic validation, and the parallel-line backstage obligation loop). Remaining optional polish: (a) wire `engine/audit/session-audit.ts` to read the new `backstageReviewLog` instead of only inferring parallel-line discipline from tool-call text; (b) tighten the `turnHasCost` core set in `tools/state/commit-turn.ts` if no-cost detection proves too coarse; (c) finding #4 (memory free-text evidence escape hatch) and #5 (debug tools in the main registry) remain open as originally scoped.

## Residual Risks

- This was a targeted scout, not a full type/schema audit. State schema/migration files were not deeply read, so exact migration impact for adding offscreen metadata remains to be scoped.
- I did not run tests or static checks because the task requested inspection only and no edits.
- Some findings involve product/design choices (e.g. keeping debug tools visible locally, keeping `scene-beat` inside `commit_turn`) and may be intentional tradeoffs.
