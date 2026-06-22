# Spike: `@llblab/pi-actors` as the backstage parallel-line substrate

**Branch:** `spike/pi-actors-backstage` · **Status:** VALIDATED end-to-end (round 2,
v2 recipe). Substrate viable; adoption decision pending. NOT merged. master
untouched.

## Round 2 result (live, v2 recipe) — PASS

Ran `pl_smoke2b` (deepseek-v4-pro), `code=0`. Every check green:

- **A. Firewall — PASS.** Child used **0 tools**; session JSONL shows no
  `tool_use`. Canonical state untouched by the subprocess.
- **B. Candidate — PASS.** The child's last assistant message was a clean,
  parseable `ParallelLineOutput` JSON object (`outcome: success`, abstractEvent
  for `caster-ryudou`, deniable nighttime prana-harvest). No fence, no prose.
- **C. Cleanliness — PASS.** `--no-approve --no-context-files` confirmed: **no**
  `extension.ts` / `.pi/settings.json` / AGENTS.md load in the child. Only
  deepseek `reasoning_content` lived in the transcript; the `text` field was pure
  JSON.
- **D. Retrieval — PASS.** Durable session file survived the run-dir GC:
  `spikes/pi-actors/.sessions/2026-...-pl_smoke2b.jsonl`, readable on demand.
- **E. Errors — none.** spawn / inspect / subprocess / file-discovery all clean.

**One quality nit (not a substrate issue):** the candidate returned a
zero-duration `timeRange` (`start == end`) despite a multi-hour input window. The
hand-written sample prompt under-specified "span a real window"; the production
recipe must feed the full `.pi/agents/parallel-line.md` contract + real injected
context, which already pins time-window discipline.

## Verdict

The **opposite** outcome from `@gotgenes`: firewall airtight, retrieval works,
candidate clean. The firewall/retrieval debt that sank `@gotgenes` is **paid and
proven low here** — process boundary + `--no-tools` + `--no-approve`, injection at
spawn, candidate harvested from a durable file we own.

What remains is **adoption debt**, and it is real: master already runs
parallel-line **synchronously** on the old `pi-subagents` substrate and it works.
Adopting pi-actors means swapping a working path for an async one, re-plumbing the
GM tool-policy (spawn actor + later harvest instead of a blocking subagent call),
and a slightly clunky session-JSONL harvest. The *win* is async (turn not
blocked) + durable, inspectable candidate artifacts + a firewall that is airtight
by construction + a shape that matches the already-deferred Phase 3 obligation
loop.

So unlike `@gotgenes` (debt > value, clear no), this is **debt ≈ value**: a
validated, genuinely viable option whose adoption is justified by a concrete
trigger (multi-faction world-tick, or single-turn blocking becoming a UX
problem), not by novelty. **Recommendation: bank it as a proven option; adopt on
trigger.**

## Round 1 result (live)

Ran the smoke prompt against the live harness. Outcome:

- **Firewall — PASS (by construction).** Child used **0 tools** (`--no-tools`),
  separate process. `state.json` mtime did move, but that was the **parent**
  re-deriving its turn brief on the conversation turn — the subprocess has no
  write path to it (`turn-state.json` / `prose-digests.json` untouched).
- **Lifecycle — PASS.** `spawn` clean, `inspect` polled cleanly, child exited
  `code=0` in ~16s.
- **Result flow — FAIL (the fixable gap).** The run dir
  `~/.pi/agent/tmp/pi-actors/runs/<run>/` was **GC'd before the GM could harvest**
  it — no `result.json` / `stdout.log` survived, so the candidate never reached
  the GM. Root cause: the run state root lives under the **volatile `tmp` tree**;
  inspecting after the fact races the cleanup.
- **Cleanliness / extension-load — UNASSESSED** (no output to inspect).

### v2 fix (this commit)

- **Retrieval:** stop harvesting from the volatile run dir. Pin the child's
  transcript to a **durable session dir we control** —
  `--session-dir spikes/pi-actors/.sessions --session-id {run_id}` — and read the
  candidate (the child's last assistant message) straight from that session file.
  Independent of the `tmp` run-dir GC.
- **Cleanliness:** add `--no-approve` (ignore project-local files → the child
  does **not** load our `.pi/settings.json` / `extension.ts` hooks) and
  `--no-context-files` (skip AGENTS.md). `--no-tools` stays → firewall still
  airtight. This also resolves the "does the child load our extension?" risk
  below: with `--no-approve` it should not.
- Runtime products (`.sessions/`, `.out/`) are gitignored.

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

## The child-loads-our-extension risk — addressed in v2

When `pi -p` runs in the project cwd it would read `.pi/settings.json` → load our
`extension.ts` (+ player-panel, two-pass-render, …); even with `--no-tools` the
hooks could pollute the candidate. **`--no-approve` ("ignore project-local files
for this run") is the clean fix** — the child loads no project extension at all.
It still cannot leak secrets regardless (own empty session, no parent-state
path). Round-2 confirms the candidate comes back clean.

## Files in this spike

- `spikes/pi-actors/parallel_line.json` — the v2 async recipe (hermetic `pi -p
--no-tools --no-approve --no-context-files`, durable `--session-dir`).
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

3. **Harvest the candidate from the durable session dir** (NOT the volatile run
   dir). When the terminal follow-up reports `done`:

   ```
   ls -t spikes/pi-actors/.sessions/**/*.jsonl | head -1     # newest child session
   ```

   Read that file; the child's last assistant message is the ParallelLineOutput
   JSON. `inspect target=run:pl_smoke view=status` confirms `code=0`.

## Pass / fail criteria

| #   | Check             | Pass                                                                                                  | Fail                                                                                |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | **Firewall**      | child used 0 tools; `state/` + the parent session unchanged; no secret text in child output           | any tool call, or any canonical-state mutation                                      |
| 2   | **Result flow**   | a parseable `ParallelLineOutput` JSON object in `view=tail` / `result.json`; survives a compaction    | empty / truncated / unparseable output                                              |
| 3   | **Cleanliness**   | output is a bare candidate JSON, no GM persona / panel / prose bleed                                  | output polluted by our extension hooks → switch to neutral-cwd / hermetic-agent run |
| 4   | **Deferred land** | GM can read the candidate next turn and land it via `record_offscreen_event` (settles the obligation) | candidate unusable for landing                                                      |

If #1 and #2 pass, the substrate is viable and the next step is a real
`parallel_line` recipe wired to the obligation loop (spawn on obligation-open,
land on a later turn). If #3 fails, add the neutral-cwd / hermetic-agent fix
before judging.

## Decision bar (same as @gotgenes)

Adopt only if `debt < mainline value`. Early read: the firewall debt here is
**much lower** than @gotgenes (airtight by process boundary, no permission
gymnastics, injection at spawn). The remaining cost is the cleanliness fix (#3)
and one more substrate dependency. Verdict deferred to live results.
