import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import {
  applyTrackedItemEvent,
  addTrackedItem,
  transferTrackedItem,
  updateTrackedItem,
} from "./tracked-item.ts";

// ─── addTrackedItem ───────────────────────────────────────────

void test("addTrackedItem records a new item", () => {
  const draft = createInitialState();

  const result = addTrackedItem(draft, {
    label: "封印物 2-049",
    itemKind: "sealed-artifact",
    holderActorId: "protagonist",
    ownerActorId: "protagonist",
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "获得封印物",
  });

  assert.ok(result.message);
  const items = Object.values(draft.public.trackedItems);
  assert.equal(items.length, 1);
  const item = items[0]!;
  assert.equal(item.label, "封印物 2-049");
  assert.equal(item.kind, "sealed-artifact");
  assert.equal(item.holderActorId, "protagonist");
  assert.equal(item.ownerActorId, "protagonist");
  assert.equal(item.condition, "intact");
  assert.equal(item.visibility, "player-known");
  assert.equal(item.location, null);
  assert.deepEqual(item.notes, []);
});

void test("addTrackedItem with notes", () => {
  const draft = createInitialState();

  addTrackedItem(draft, {
    label: "Creeping Hunger",
    itemKind: "sealed-artifact",
    holderActorId: null,
    ownerActorId: null,
    condition: "unknown",
    visibility: "player-known",
    notes: ["危险封印物，使用前必须确认状态"],
    reason: "记录 Creeping Hunger",
  });

  const item = Object.values(draft.public.trackedItems)[0]!;
  assert.equal(item.holderActorId, null);
  assert.equal(item.ownerActorId, null);
  assert.deepEqual(item.notes, ["危险封印物，使用前必须确认状态"]);
});

void test("addTrackedItem rejects missing holder actor", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      addTrackedItem(draft, {
        label: "封印物",
        itemKind: "sealed-artifact",
        holderActorId: "nonexistent",
        ownerActorId: null,
        condition: "intact",
        visibility: "player-known",
        notes: [],
        reason: "测试",
      }),
    /holder actor 不存在/,
  );
});

void test("addTrackedItem rejects missing owner actor", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      addTrackedItem(draft, {
        label: "封印物",
        itemKind: "sealed-artifact",
        holderActorId: null,
        ownerActorId: "nonexistent",
        condition: "intact",
        visibility: "player-known",
        notes: [],
        reason: "测试",
      }),
    /owner actor 不存在/,
  );
});

void test("addTrackedItem rejects empty label", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      addTrackedItem(draft, {
        label: "",
        itemKind: "sealed-artifact",
        holderActorId: null,
        ownerActorId: null,
        condition: "intact",
        visibility: "player-known",
        notes: [],
        reason: "测试",
      }),
    /label/,
  );
});

void test("addTrackedItem rejects empty reason", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      addTrackedItem(draft, {
        label: "封印物",
        itemKind: "sealed-artifact",
        holderActorId: null,
        ownerActorId: null,
        condition: "intact",
        visibility: "player-known",
        notes: [],
        reason: "",
      }),
    /reason/,
  );
});

// ─── transferTrackedItem ──────────────────────────────────────

void test("transferTrackedItem updates holder and clears location", () => {
  const draft = createInitialState();
  addTrackedItem(draft, {
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: "protagonist",
    ownerActorId: "protagonist",
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;
  // set a location to verify it gets cleared
  draft.public.trackedItems[itemId]!.location = {
    region: "鲁恩王国",
    site: "值夜者总部",
    detail: "",
    boundary: "normal",
  };

  const result = transferTrackedItem(draft, itemId, null, "上交封印物");

  assert.ok(result.message);
  assert.equal(draft.public.trackedItems[itemId]!.holderActorId, null);
  assert.equal(draft.public.trackedItems[itemId]!.location, null);
});
void test("transferTrackedItem to another actor", () => {
  const draft = createInitialState();
  draft.public.actors["dunn"] = {
    id: "dunn",
    kind: "human",
    sequence: null,
    identity: { publicIdentity: "值夜者队长", background: "值夜者", lockedFacts: [], roles: [] },
    presentation: {
      canonicalName: "Dunn Smith",
      renderName: "Dunn Smith",
      apparentAge: "40s",
      outfit: { label: "制服", details: "" },
      demeanor: "威严",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "ally", summary: "上司" },
  };
  addTrackedItem(draft, {
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: "protagonist",
    ownerActorId: "protagonist",
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;

  transferTrackedItem(draft, itemId, "dunn", "交给队长保管");

  assert.equal(draft.public.trackedItems[itemId]!.holderActorId, "dunn");
  assert.equal(draft.public.trackedItems[itemId]!.location, null);
});

void test("transferTrackedItem rejects missing item", () => {
  const draft = createInitialState();
  assert.throws(
    () => transferTrackedItem(draft, "nonexistent", null, "测试"),
    /tracked item 不存在/,
  );
});

void test("transferTrackedItem rejects missing holder actor", () => {
  const draft = createInitialState();
  addTrackedItem(draft, {
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: "protagonist",
    ownerActorId: "protagonist",
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;

  assert.throws(
    () => transferTrackedItem(draft, itemId, "nonexistent", "测试"),
    /holder actor 不存在/,
  );
});

void test("transferTrackedItem rejects empty reason", () => {
  const draft = createInitialState();
  addTrackedItem(draft, {
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: null,
    ownerActorId: null,
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;

  assert.throws(() => transferTrackedItem(draft, itemId, null, ""), /reason/);
});

// ─── updateTrackedItem ────────────────────────────────────────

void test("updateTrackedItem changes holder", () => {
  const draft = createInitialState();
  addTrackedItem(draft, {
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: "protagonist",
    ownerActorId: "protagonist",
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;

  updateTrackedItem(draft, {
    itemId,
    holderActorId: null,
    reason: "上交",
  });

  assert.equal(draft.public.trackedItems[itemId]!.holderActorId, null);
  assert.equal(draft.public.trackedItems[itemId]!.location, null);
});

void test("updateTrackedItem changes owner", () => {
  const draft = createInitialState();
  addTrackedItem(draft, {
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: "protagonist",
    ownerActorId: "protagonist",
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;

  updateTrackedItem(draft, {
    itemId,
    ownerActorId: null,
    reason: "放弃所有权",
  });

  assert.equal(draft.public.trackedItems[itemId]!.ownerActorId, null);
  assert.equal(draft.public.trackedItems[itemId]!.holderActorId, "protagonist"); // unchanged
});

void test("updateTrackedItem changes condition", () => {
  const draft = createInitialState();
  addTrackedItem(draft, {
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: null,
    ownerActorId: null,
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;

  updateTrackedItem(draft, {
    itemId,
    condition: "damaged",
    reason: "战斗中损坏",
  });

  assert.equal(draft.public.trackedItems[itemId]!.condition, "damaged");
});

void test("updateTrackedItem changes notes", () => {
  const draft = createInitialState();
  addTrackedItem(draft, {
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: null,
    ownerActorId: null,
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;

  updateTrackedItem(draft, {
    itemId,
    notes: ["已绑定", "注意使用限制"],
    reason: "补充备注",
  });

  assert.deepEqual(draft.public.trackedItems[itemId]!.notes, ["已绑定", "注意使用限制"]);
});

void test("updateTrackedItem rejects missing item", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      updateTrackedItem(draft, {
        itemId: "nonexistent",
        reason: "测试",
      }),
    /tracked item 不存在/,
  );
});

void test("updateTrackedItem rejects missing holder actor", () => {
  const draft = createInitialState();
  addTrackedItem(draft, {
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: null,
    ownerActorId: null,
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;

  assert.throws(
    () =>
      updateTrackedItem(draft, {
        itemId,
        holderActorId: "nonexistent",
        reason: "测试",
      }),
    /holder actor 不存在/,
  );
});

void test("updateTrackedItem rejects missing owner actor", () => {
  const draft = createInitialState();
  addTrackedItem(draft, {
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: null,
    ownerActorId: null,
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;

  assert.throws(
    () =>
      updateTrackedItem(draft, {
        itemId,
        ownerActorId: "nonexistent",
        reason: "测试",
      }),
    /owner actor 不存在/,
  );
});

// ─── applyTrackedItemEvent dispatch ──────────────────────────

void test("applyTrackedItemEvent dispatches add-tracked-item", () => {
  const draft = createInitialState();

  const result = applyTrackedItemEvent(draft, {
    kind: "add-tracked-item",
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: null,
    ownerActorId: null,
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "测试",
  });

  assert.ok(result.message);
  assert.equal(Object.keys(draft.public.trackedItems).length, 1);
});

void test("applyTrackedItemEvent dispatches transfer-tracked-item", () => {
  const draft = createInitialState();
  // add an item first
  applyTrackedItemEvent(draft, {
    kind: "add-tracked-item",
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: "protagonist",
    ownerActorId: "protagonist",
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;

  const result = applyTrackedItemEvent(draft, {
    kind: "transfer-tracked-item",
    itemId,
    holderActorId: null,
    reason: "上交",
  });

  assert.ok(result.message);
  assert.equal(draft.public.trackedItems[itemId]!.holderActorId, null);
});

void test("applyTrackedItemEvent dispatches update-tracked-item", () => {
  const draft = createInitialState();
  applyTrackedItemEvent(draft, {
    kind: "add-tracked-item",
    label: "封印物",
    itemKind: "sealed-artifact",
    holderActorId: null,
    ownerActorId: null,
    condition: "intact",
    visibility: "player-known",
    notes: [],
    reason: "初始持有",
  });
  const itemId = Object.keys(draft.public.trackedItems)[0]!;

  const result = applyTrackedItemEvent(draft, {
    kind: "update-tracked-item",
    itemId,
    condition: "damaged",
    reason: "战斗中损坏",
  });

  assert.ok(result.message);
  assert.equal(draft.public.trackedItems[itemId]!.condition, "damaged");
});
