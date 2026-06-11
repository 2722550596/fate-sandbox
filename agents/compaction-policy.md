# FSN Compaction Policy

Compact the conversation history itself, not the campaign state, project files, git history, or a coding task log.

Runtime state may be provided only as exclusion reference. If something appears to be an established campaign fact, a completed scene event, a tool result already applied to state, or a durable rule, omit it unless it is required to continue the currently unfinished user request.

A previous compaction summary may also be provided as exclusion reference. Treat everything it records as already preserved: output only the delta — what changed, emerged, or was resolved since that summary. Never re-narrate content it already covers; if an item it records is now resolved, drop it instead of restating it.

## Preserve only

1. The current unfinished user request or split-turn context.
2. User corrections to the assistant's framing.
3. Conversation-level decisions about workflow, memory, compaction, prompts, or narrative direction that are not obviously persisted elsewhere.
4. Open loops that require the next assistant response.
5. Artifact conclusions discussed in chat only when they remain actionable.
6. Narrative texture that neither Game State nor Campaign Memory can hold (see the Narrative Texture section).

## Do not preserve

- Long campaign chronology.
- Setup steps.
- Scene-by-scene completed progress.
- Tool/schema error history unless the active topic is tool debugging.
- Files read, files modified, commands run, quality gates, commits, pushes, or git status.
- State snapshots or long lists of state facts.
- Repeated durable prompt/data/state rules.
- Exhaustive character, location, item, or offscreen-event facts.
- A checklist of completed tool actions.

## Required output shape

Use only these sections, and omit any section that has nothing important:

### Conversation Memory

3-8 bullets. Keep only conversation-local memory that will matter after compaction.

### Current Pending Turn

Only if there is an unfinished user request, split turn, or immediate next response obligation. Include enough context for the next assistant message and nothing else.

### User Corrections / Preferences

Only corrections or preferences that are not already obvious from the current prompt or durable project rules.

### Open Loops

Only unresolved conversational loops.

### Narrative Texture

At most 5 bullets. Only narrative qualities that Game State and Campaign Memory cannot hold: the current tone register of the scene, foreshadowing whose exact phrasing matters, relationship temperature between actors, unresolved dramatic tension. Each bullet must be something the next GM response would get wrong without it. No plot recap, no facts that belong in state, no character sheets.

## Hard bans

Do not use these sections or formats:

- Goal
- Progress
- Done
- In Progress
- Blocked
- Files Read
- Files Modified
- Key Decisions as a broad project ledger
- Critical Context as a giant lore dump
- Tool/schema gotchas
- chronological campaign recap
- checkbox task history

Target length: 800-1500 words maximum. Prefer much shorter when there is no unfinished turn.
