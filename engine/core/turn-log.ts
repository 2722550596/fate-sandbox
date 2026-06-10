import type { State, TurnLogEntry } from "./state";

export function appendTurnLogEntry(draft: State, input: Omit<TurnLogEntry, "id">): TurnLogEntry {
  const entry: TurnLogEntry = {
    id: nextTurnLogId(draft.public.turnLog),
    ...input,
  };
  draft.public.turnLog.push(entry);
  return entry;
}

function nextTurnLogId(entries: readonly TurnLogEntry[]): string {
  let highest = 0;
  for (const entry of entries) {
    const suffix = entry.id.startsWith("turn-") ? entry.id.slice("turn-".length) : "";
    if (!/^\d+$/.test(suffix)) continue;
    highest = Math.max(highest, Number(suffix));
  }
  return `turn-${highest + 1}`;
}
