# Spike: `@llblab/pi-actors` as the backstage parallel-line substrate

**Branch:** `spike/pi-actors-backstage` · **Status:** scaffolding ready, pending
live validation. NOT merged. master untouched.

## Why this spike

The `@gotgenes` in-process migration was abandoned (see
`in-process-subagents.md`): it broke context injection and the secret firewall
for an ergonomic-only payoff. `@llblab/pi-actors` is a **different shape** — a
local actor kernel (`spawn` / `message` / `inspect`) over **detached
processes**, async-first. It does NOT share the parent's memory, so it is not a
path to a synchronous one-shot. But that is fine: our Phase 3 backstage model is
already **deferred** (open obligation now → settle on a later canonical turn), so
an async candidate that lands later fits naturally.

Two things this spike must prove **live** (neither is runnable headless — the
child needs the harness + a model):

1. **Firewall** — a spawned backstage actor cannot read or write the GM's
   canonical state or secrets.
2. **Result flow** — the candidate JSON reliably comes back to the GM, readable
   via `inspect`, surviving context compaction.

## Why the firewall is airtight *by construction* (the part we CAN reason about)

Unlike `@gotgenes` (shared in-process memory; firewall depended on fragile
per-agent permission resolution), pi-actors runs the child as a **separate `pi`
process**:

- `template: "pi -p --no-tools --model {model} {prompt}"` — `--no-tools` gives
  the child **zero tools**. It cannot call `commit_turn`, `record_offscreen_event`,
  `reveal_secret`, `patch_state`, `lookup`, or anything else. (Documented
  hermetic pattern, `docs/tool-registry.md`.)
- The child opens its **own empty session**. The parent's canonical state lives
  only in the parent process memory + the parent session file; the child never
  opens that session, so there is **no path to parent secrets**.
- The child's only input is the `prompt` we hand it — the subagent-**safe**
  projection (`buildTimelineStateContextBlock`) plus the `ParallelLineInput`. No
  secret ever enters the prompt (same firewall the old substrate used).
- This also **dodges the two failures that killed `@gotgenes`**: injection is
  done at spawn time (the full prompt is built before the process starts, not by
  mutating a live tool-call event), and the firewall is the process boundary +
  `--no-tools`, not a permission package.

So the *secret* firewall is structurally sound. What still needs live eyes is
the **process-boundary cleanliness** (below).

## The one real open risk: does the child load our GM extension?

When `pi -p` runs in the project cwd it reads `.pi/settings.json` → loads our
`extension.ts` (+ player-panel, two-pass-render, …). With `--no-tools` those
tools are dead, but the extensions' **hooks** (`session_start` →
`syncStateFromSessionManager`, context transforms, GM-prompt injection) may still
fire in the child and **pollute the candidate prompt** with GM persona/scaffolding.

It cannot leak secrets (the child's session is empty — `syncStateFromSessionManager`
finds nothing to hydrate), but it can make the candidate noisy or off-contract.
Mitigation to test: run the actor from a **neutral cwd** (e.g. the run state dir)
so it does not load our project `.pi/settings.json`, or point `pi -p` at a
hermetic agent. The prompt is fully self-contained, so no project context is
needed for the child to do its job.

## Files in this spike

- `spikes/pi-actors/parallel_line.json` — the async recipe (hermetic `pi -p
  --no-tools` candidate generator).
- `spikes/pi-actors/sample-backstage-prompt.md` — a ready, self-contained test
  prompt (safe projection + ParallelLineInput + "output bare JSON").
- `.pi/settings.json` — adds `npm:@llblab/pi-actors` (spike-only).

## Live validation steps (run on your machine)

0. **Restart `./start.sh`** so pi installs `@llblab/pi-actors`.
1. **Activate the recipe** (recipes load from the user root):

   ```
   mkdir -p ~/.pi/agent/recipes
   cp spikes/pi-actors/parallel_line.json ~/.pi/agent/recipes/parallel_line.json
   ```

   Then in-session confirm discovery: `inspect target=recipes view=summary`.
2. **Spawn the backstage actor** with the sample prompt:

   ```
   parallel_line prompt="$(cat spikes/pi-actors/sample-backstage-prompt.md)" run_id=pl_smoke
   ```

   (Or ask the GM to spawn `parallel_line` with that file's contents as `prompt`.)
3. **Inspect the result** once it finishes:

   ```
   inspect target=run:pl_smoke view=status
   inspect target=run:pl_smoke view=tail lines=120
   ```

   `stdout.log` / `result.json` should hold the candidate.

## Pass / fail criteria

| # | Check | Pass | Fail |
| - | ----- | ---- | ---- |
| 1 | **Firewall** | child used 0 tools; `state/` + the parent session unchanged; no secret text in child output | any tool call, or any canonical-state mutation |
| 2 | **Result flow** | a parseable `ParallelLineOutput` JSON object in `view=tail` / `result.json`; survives a compaction | empty / truncated / unparseable output |
| 3 | **Cleanliness** | output is a bare candidate JSON, no GM persona / panel / prose bleed | output polluted by our extension hooks → switch to neutral-cwd / hermetic-agent run |
| 4 | **Deferred land** | GM can read the candidate next turn and land it via `record_offscreen_event` (settles the obligation) | candidate unusable for landing |

If #1 and #2 pass, the substrate is viable and the next step is a real
`parallel_line` recipe wired to the obligation loop (spawn on obligation-open,
land on a later turn). If #3 fails, add the neutral-cwd / hermetic-agent fix
before judging.

## Decision bar (same as @gotgenes)

Adopt only if `debt < mainline value`. Early read: the firewall debt here is
**much lower** than @gotgenes (airtight by process boundary, no permission
gymnastics, injection at spawn). The remaining cost is the cleanliness fix (#3)
and one more substrate dependency. Verdict deferred to live results.
