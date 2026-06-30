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
and a slightly clunky session-JSONL harvest. The _win_ is async (turn not
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

## Why the firewall is airtight _by construction_ (the part we CAN reason about)

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

So the _secret_ firewall is structurally sound. What still needs live eyes is
the **process-boundary cleanliness** (below).

## The child-loads-our-extension risk — addressed in v2

When `pi -p` runs in the project cwd it would read `.pi/settings.json` → load our
`extension.ts` (+ player-panel, two-pass-render, …); even with `--no-tools` the
hooks could pollute the candidate. **`--no-approve` ("ignore project-local files
for this run") is the clean fix** — the child loads no project extension at all.
It still cannot leak secrets regardless (own empty session, no parent-state
path). Round-2 confirms the candidate comes back clean.

## Probe 2: persistent-memory director (the real shape-change)

The round-1/2 substrate proved the **stateless** shape (one-shot hermetic JSON) —
the same shape the old `pi-subagents` already does, just async + durable. The
genuinely new capability `pi-subagents` **structurally cannot** do is a
**persistent director**: an actor that resumes its OWN session across turns and
carries an evolving backstage agenda forward, without the GM re-injecting full
history each turn. Stateless function → stateful character with continuity.

### How (one-line change from v2)

Pin `--session-id` to a **stable per-director id** (`dir-caster`), NOT the
per-run id. Re-invoking the recipe across turns with the same `session_id`
resumes the same pi session — the director sees its own prior turns. Recipe:
`spikes/pi-actors/faction_director.json`.

### Firewall under persistence

Persistence does **not** weaken the firewall. The director's session only ever
contains what we put in it — subagent-safe projections + its own planning. No game
secret is ever placed in that session, so none can accumulate. `--no-tools`
`--no-approve` still hold: zero tools, no project extension, no canonical-state
path. Persistent ≠ leaky.

### Continuity canary (how we prove resume actually happened)

The output carries a `carryForward` object with a `codeword` the director
**invents at random on turn 1**. Turn 2 sends only a short delta (no world
projection re-injected) and must echo the **exact same codeword** + advance the
recorded `nextSteps`. The codeword is unguessable, so a turn-2 match can only mean
the session genuinely resumed. Files:
`spikes/pi-actors/sample-director-turn1.md` (establish + invent codeword),
`spikes/pi-actors/sample-director-turn2.md` (delta + must restate codeword).

### Pass / fail (probe 2)

| #   | Check            | Pass                                                                        |
| --- | ---------------- | --------------------------------------------------------------------------- |
| P1  | **Persistence**  | turn-2 `carryForward.codeword` == turn-1's invented codeword; plan advanced |
| P2  | **Firewall**     | both turns: 0 tools; the resumed session file holds NO secret text          |
| P3  | **No re-inject** | turn-2 prompt carries no world projection, yet the candidate stays in-scope |
| P4  | **Output**       | both turns return a clean bare ParallelLineOutput JSON with `carryForward`  |

If P1 + P3 pass, the persistent-director shape is real and `pi-actors` clears the
bar `pi-subagents` cannot reach: a backstage faction that remembers itself.

### Probe 2 result (live) — PASS

Two spawns (`pl_dir_t1`, `pl_dir_t2`), **same `session_id=dir-caster-smoke`**,
deepseek-v4-pro.

- **P1 Persistence — PASS.** Turn-1 invented codeword `"gloamseed"`; turn-2
  (separate process, separate run) returned the **exact same** `"gloamseed"` and
  advanced turn-1's `nextSteps[0]` (shopping-district siphon) instead of repeating
  it. The codeword is unguessable → the session genuinely resumed. **This is the
  capability `pi-subagents` structurally cannot reach.**
- **P2 Firewall — PASS.** 0 tools both turns; session file holds only the safe
  projection + the director's own outputs. No secret, no canonical state.
- **P3 No re-inject — PASS.** Turn-2 prompt carried no world projection (only a
  short delta); the candidate stayed in `caster-ryudou` scope, no forbidden
  escalation. Continuity came from the director's own resumed memory.
- **P4 Output — PASS.** Both turns bare `ParallelLineOutput` JSON with
  `carryForward`.

### Two operational learnings for productionization

1. **Pin the backstage model; do not inherit `{current_model}`.** `pl_dir_t1`
   first failed `code=1` on an inherited Anthropic-Opus billing error; the
   deepseek retry succeeded. A backstage director must run on a pinned,
   known-good, cheap model with a fallback — not whatever the GM happens to be on.
2. **A persistent session accumulates cruft.** The failed attempt left a
   zero-usage error entry in the session (it did not pollute output, but it
   stayed). Across many turns a resumed session grows unbounded and collects
   failed-attempt noise → productionization needs session hygiene (pin model to
   cut failures, and/or periodic re-seed/compaction of the director session).

**Verdict (probe 2):** the differentiating shape is **validated**. Combined with
round-1/2 (async + durable retrieval), `pi-actors` is now comprehensively proven
as a backstage substrate: hermetic firewall in every mode, durable inspectable
candidates, and — uniquely — persistent self-remembering directors.

## Probe 3: swarm — concurrent independent directors (the "world tick")

The last map item. Key reframe: **our swarm does NOT need pi-actors'
`parallel`-template primitive.** Our swarm is **N independent persistent directors
fired concurrently — one per faction with an open obligation** — which is exactly
what the Phase 3 ledger already enumerates. So we reuse the validated
`faction_director.json` (no new recipe) and just fire one spawn per faction, each
with its own stable `session_id`. The probe only has to prove **concurrency does
not cross-contaminate**.

### Setup

Two factions with disjoint agendas/scope/knowledge, fired at the same time:
`dir-caster-swarm` (prana harvest, scope `caster-ryudou`) and `dir-assassin-swarm`
(gate watch, scope `assassin-ryudou`,
`spikes/pi-actors/sample-director-assassin-turn1.md`).

### Pass / fail (probe 3)

| #   | Check             | Pass                                                                                                                                      |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Concurrency**   | both runs reach `code=0`; they overlap in time (not serialized by us)                                                                     |
| S2  | **Isolation** 🔑  | Caster candidate is Caster-only, Assassin candidate is Assassin-only; codewords differ; neither session file contains the other's content |
| S3  | **Batch harvest** | the GM collects both candidates cleanly into one tick batch                                                                               |
| S4  | **Output**        | both bare `ParallelLineOutput` JSON with `carryForward`                                                                                   |

If S1 + S2 pass, the "world breathing" floor is real: many factions advance
offscreen at once, each in its own sealed lane. (Cross-faction **coordination** —
`room`/`coordinator`, where faction A's move informs faction B — is a deeper,
separate capability; not in scope here. Independent fan-out is the floor we need
first.)

### Probe 3 result (live) — PASS

Two concurrent spawns (`pl_caster_sw` / `dir-caster-swarm`, `pl_assassin_sw` /
`dir-assassin-swarm`), deepseek-v4-pro, model pinned per learning #1.

- **S1 Concurrency — PASS.** Starts 43ms apart
  (`05:54:38.696Z` / `05:54:38.739Z`), both ran ~20s fully overlapped, both
  `code=0`. Genuine parallelism.
- **S2 Isolation — PASS.** Distinct invented codewords
  (`twilight-thread` vs `Kagemusha`). Caster candidate is harvest-only, Assassin
  candidate is gate-watch-only. Each session file contains **zero** of the
  other's content. Firewall holds per-faction under concurrency.
- **S3 Batch harvest — PASS.** Both candidates collected from their session
  files into one tick batch.
- **S4 Output — PASS.** Both bare `ParallelLineOutput` JSON with `carryForward`.

**Real finding (the next frontier, not a failure):** Caster's `nextSteps`
included "have Assassin scout the town perimeter" — it tried to **direct** another
faction it saw in its own context. In independent fan-out, Assassin (a separate
director) never receives that; it would be the GM's job to fold such a
cross-faction intent into Assassin's next delta. This precisely marks the
boundary between the validated **independent fan-out** floor and the deeper
**coordination** ceiling (`room`/`coordinator`).

## Probe 4: cross-faction coordination — engine-mediated, NOT native room

The deeper ceiling: faction A's move informs faction B (Caster commands
Assassin). Research finding **before** building decided the shape:

### Why native `room`/`coordinator` is the wrong tool here

pi-actors' native coordination (`room:<run>` + `branch:<run>/<branch>` +
`coordinator`) requires the participants to be **long-lived worker actors that
carry `message`/`inspect` tools** — they post to and read the shared room. The
docs are explicit: backstage workers "should be **long-lived workers, not
one-shot prompts**" that "claim … and share `room:<run>` for visibility." That is
exactly what our hermetic firewall forbids: our directors are **one-shot
`pi -p --no-tools`** (zero tools → cannot message a room; exit immediately).
Native room would force tool-bearing, long-lived children — a regression to the
fragile `@gotgenes`-style scoped-tool firewall.

And pi-actors' **own docs** point the other way:

> "Use pi-actors as the actor runtime **without making pi-actors own swarm
> semantics**. The **coordinator prepares scope** … the async run owns fanout,
> state, logs, status."
> "`communication.json` is visible actor context, **not a global mutable truth
> table**."

### The fsn-correct shape: the engine is the coordinator

Coordination flows through the **canonical world state the GM owns**, not an
out-of-band actor room. Caster (tick 1) emits a structured cross-faction order;
the **GM (coordinator)** extracts it and threads it into Assassin's tick-2 delta;
Assassin executes it. Directors stay one-shot hermetic `--no-tools`; the firewall
is untouched; it matches "engine is the single source of truth" and the deferred
obligation model. Files: `sample-coord-caster-turn1.md` (Caster issues
`carryForward.ordersToAllies`), `sample-coord-assassin-turn2.md` (delta with a
`{{CASTER_ORDER}}` insert point the GM fills).

### Pass / fail (probe 4)

| #   | Check              | Pass                                                                                                                           |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| C1  | **A issues order** | Caster tick-1 emits a well-formed `ordersToAllies` entry for `assassin-ryudou`                                                 |
| C2  | **GM relays**      | the order text is extracted and threaded into Assassin's delta (no direct A↔B channel)                                         |
| C3  | **B executes** 🔑  | Assassin tick-2 candidate visibly carries out Caster's order (behavior changed), within its own constraints (still gate-bound) |
| C4  | **Firewall holds** | both directors 0 tools, one-shot; Assassin never read Caster's session; no secret crossed                                      |

If C3 + C4 pass, cross-faction coordination works **with the firewall intact**:
the GM/engine is the coordination surface, pi-actors only owns fanout — exactly
the layering pi-actors' docs endorse.

### Probe 4 result (live) — PASS

Three spawns (`pl_caster_c1`/`dir-caster-coord`, `pl_assassin_c1` +
`pl_assassin_c2`/`dir-assassin-coord`), deepseek-v4-pro.

- **C1 A issues order — PASS.** Caster emitted a well-formed `ordersToAllies`
  entry for `assassin-ryudou` ("remain at the gate, spirit-form, detect approach
  up the stairway, report mana/Master presence, do not engage unless the barrier
  is threatened").
- **C2 GM relays — PASS.** The coordinator extracted only the `order` string and
  substituted it into Assassin's `{{CASTER_ORDER}}` slot. The directors never
  spoke directly.
- **C3 B executes — PASS.** A_T1 was a passive physical vigil; A_T2 visibly
  **transformed** to spirit-form with a sensory net extended down the full
  stairway + an explicit no-engage/report protocol — and stayed gate-bound (no
  physical descent). `acknowledgedOrder` confirmed the landing; codeword
  `VigilantHollow` held across both turns. **B obeyed A while respecting B's own
  constraints** — coordination with integrity.
- **C4 Firewall — PASS.** Both directors 0 tools, one-shot. Assassin's session
  held only its own prompts/outputs + the relayed order string — none of Caster's
  candidate, codeword (`Ichorfeather`), planState, or nextSteps. No secret
  crossed in either direction.

Cross-faction coordination is validated **the fsn-correct way**: the engine is
the coordinator, canonical state is the shared board, pi-actors owns only fanout,
and the hermetic firewall is untouched.

_(A separate, opt-in probe could stress the **native** `room`/`coordinator`
primitive with tool-bearing long-lived branch actors — at the documented firewall
cost. Not pursued here; engine-mediated is the fsn-correct path.)_

---

## Spike complete — capability map 5/5 validated

| Capability                        | Verdict                 | `pi-subagents` can? |
| --------------------------------- | ----------------------- | ------------------- |
| Async hermetic single-line        | ✅ r1/r2                | partial (sync only) |
| Durable, inspectable retrieval    | ✅ r2                   | ❌                  |
| **Persistent-memory director**    | ✅ p2                   | ❌ (structural)     |
| **Swarm: concurrent independent** | ✅ p3                   | ❌                  |
| **Cross-faction coordination**    | ✅ p4 (engine-mediated) | ❌                  |

The firewall held in **every** mode (single, persistent, concurrent, coordinated):
0 tools, no secret ever in any child session, no canonical-state path. The
differentiators `pi-subagents` cannot reach — self-remembering directors, a
concurrent multi-faction world tick, and engine-mediated cross-faction
coordination — are all proven.

### Recommendation

**Adopt `pi-actors` as the backstage-generation substrate — incrementally, on a
trigger — keeping the Phase 3 obligation ledger as the engine-side correctness
spine.** This is a clean layering, not a rip-and-replace:

- **Correctness stays in the engine** (Phase 3 ledger: open obligation → settle on
  a later canonical turn via `record_offscreen_event`). Version-controlled,
  tested. Unchanged.
- **Generation moves to pi-actors** (async hermetic directors, durable
  candidates, persistent per-faction memory). Replaces the old synchronous
  `pi-subagents` parallel-line call.

**Productionization must-dos (from live learnings):**

1. **Pin a cheap, known-good backstage model with fallback** — do not inherit
   `{current_model}` (Opus billing failure observed; deepseek worked).
2. **Session hygiene for persistent directors** — failed attempts accumulate in
   the resumed session; pin the model to cut failures and/or periodically
   re-seed/compact the director session.
3. **A clean harvest path** — the session-JSONL last-assistant-message read works
   but is clunky; a thin harvest helper (or a declared durable artifact) is worth
   it before wiring into the loop.

**Adoption trigger:** wire it when backstage breadth actually demands it —
multi-faction world ticks, or single-turn synchronous generation becoming a UX
block. Until then the validated spike stands as a proven, ready option; master's
working synchronous substrate is fine as the baseline.

**Cross-faction coordination:** see Probe 4 above — pursued via the
**engine-mediated** shape (GM as coordinator, canonical state as the shared
board), because native `room`/`coordinator` would break the hermetic firewall by
requiring tool-bearing long-lived actors. The native primitive remains an
opt-in-at-firewall-cost probe, not the fsn path.

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
