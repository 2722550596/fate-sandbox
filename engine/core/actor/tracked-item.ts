import type {
  TrackedItemCondition,
  TrackedItemKind,
  TrackedItemVisibility,
} from "../state/state-enum-schemas.ts";
import type { State } from "../state/state.ts";

import { settleOldestObligation } from "../obligations.ts";
import { createId } from "../utils/ids.ts";
import { assertNonEmptyString } from "../utils/typebox-validation.ts";

export interface TrackedItemEventResult {
  message: string;
}

export function transferTrackedItem(
  draft: State,
  itemId: string,
  holderActorId: string | null,
  reason: string,
): TrackedItemEventResult {
  assertNonEmptyString(reason, "reason");
  const item = draft.public.trackedItems[itemId];
  if (item === undefined) {
    throw new Error(`tracked item 不存在: ${itemId}`);
  }
  const holderId = holderActorId ?? null;
  if (holderId !== null && draft.public.actors[holderId] === undefined) {
    throw new Error(`holder actor 不存在: ${holderId}`);
  }
  item.holderActorId = holderId;
  item.location = null;
  return { message: "重要物品持有者已更新。" };
}

export function updateTrackedItem(
  draft: State,
  event: {
    itemId: string;
    holderActorId?: string | null | undefined;
    ownerActorId?: string | null | undefined;
    condition?: TrackedItemCondition | undefined;
    notes?: string[] | undefined;
    reason: string;
  },
): TrackedItemEventResult {
  assertNonEmptyString(event.reason, "reason");
  const item = draft.public.trackedItems[event.itemId];
  if (item === undefined) {
    throw new Error(`tracked item 不存在: ${event.itemId}`);
  }
  if (event.holderActorId !== undefined) {
    const holderId = event.holderActorId ?? null;
    if (holderId !== null && draft.public.actors[holderId] === undefined) {
      throw new Error(`holder actor 不存在: ${holderId}`);
    }
    item.holderActorId = holderId;
    item.location = null;
  }
  if (event.ownerActorId !== undefined) {
    const ownerId = event.ownerActorId ?? null;
    if (ownerId !== null && draft.public.actors[ownerId] === undefined) {
      throw new Error(`owner actor 不存在: ${ownerId}`);
    }
    item.ownerActorId = ownerId;
  }
  if (event.condition !== undefined) {
    item.condition = event.condition;
  }
  if (event.notes !== undefined) {
    item.notes = event.notes;
  }
  return { message: `重要物品已更新：${event.itemId}。` };
}

export function addTrackedItem(
  draft: State,
  event: {
    label: string;
    itemKind: TrackedItemKind;
    holderActorId: string | null;
    ownerActorId: string | null;
    condition: TrackedItemCondition;
    visibility: TrackedItemVisibility;
    notes: string[];
    reason: string;
  },
): TrackedItemEventResult {
  assertNonEmptyString(event.label, "label");
  assertNonEmptyString(event.reason, "reason");
  const holderId = event.holderActorId ?? null;
  const ownerId = event.ownerActorId ?? null;
  if (holderId !== null && draft.public.actors[holderId] === undefined) {
    throw new Error(`holder actor 不存在: ${holderId}`);
  }
  if (ownerId !== null && draft.public.actors[ownerId] === undefined) {
    throw new Error(`owner actor 不存在: ${ownerId}`);
  }
  const id = createId(draft, "item");
  draft.public.trackedItems[id] = {
    id,
    label: event.label,
    kind: event.itemKind,
    ownerActorId: ownerId,
    holderActorId: holderId,
    location: null,
    condition: event.condition,
    visibility: event.visibility,
    notes: event.notes,
  };
  return { message: "重要物品已记录到追踪列表。" };
}

export function applyTrackedItemEvent(
  draft: State,
  event: import("./tracked-item-schema.ts").TrackedItemEvent,
): TrackedItemEventResult {
  let result: TrackedItemEventResult;
  switch (event.kind) {
    case "transfer-tracked-item":
      result = transferTrackedItem(draft, event.itemId, event.holderActorId, event.reason);
      break;
    case "update-tracked-item":
      result = updateTrackedItem(draft, event);
      break;
    case "add-tracked-item":
      result = addTrackedItem(draft, event);
      break;
    default:
      throw new Error("unreachable tracked item event kind");
  }
  settleOldestObligation(draft, ["tracked-item"]);
  return result;
}
