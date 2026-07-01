import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import { removeActorEverywhere, retireActor, setScenePresence, upsertActor } from "./actor.ts";

// ─── setScenePresence ───────────────────────────────────────────

void test("setScenePresence sets present and ally actor IDs", () => {
  const draft = createInitialState();
  // add a second actor so there's someone to reference
  draft.public.actors["sherlock"] = {
    id: "sherlock",
    kind: "human",
    sequence: null,
    identity: { publicIdentity: "侦探", background: "值夜者", roles: [], lockedFacts: [] },
    presentation: {
      canonicalName: "Sherlock",
      renderName: "Sherlock",
      apparentAge: "30s",
      outfit: { label: "风衣", details: "黑色风衣" },
      demeanor: "冷静",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "ally", summary: "可信的值夜者同事" },
  };

  const result = setScenePresence(draft, {
    reason: "进入值夜者据点",
    presentActorIds: ["protagonist", "sherlock"],
    allyActorIds: ["sherlock"],
  });

  assert.equal(result.message, "场景在场 actor 已更新。");
  assert.deepEqual(draft.public.scene.presentActorIds, ["protagonist", "sherlock"]);
  assert.deepEqual(draft.public.allyActorIds, ["sherlock"]);
});

void test("setScenePresence throws on unknown present actor", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      setScenePresence(draft, {
        reason: "test",
        presentActorIds: ["protagonist", "does-not-exist"],
        allyActorIds: [],
      }),
    /presentActorIds 包含不存在的 actor/,
  );
});

void test("setScenePresence throws on unknown ally actor", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      setScenePresence(draft, {
        reason: "test",
        presentActorIds: ["protagonist"],
        allyActorIds: ["does-not-exist"],
      }),
    /allyActorIds 包含不存在的 actor/,
  );
});

void test("setScenePresence deduplicates actor IDs", () => {
  const draft = createInitialState();
  draft.public.actors["sherlock"] = {
    id: "sherlock",
    kind: "human",
    sequence: null,
    identity: { publicIdentity: "侦探", background: "值夜者", roles: [], lockedFacts: [] },
    presentation: {
      canonicalName: "Sherlock",
      renderName: "Sherlock",
      apparentAge: "30s",
      outfit: { label: "风衣", details: "黑色风衣" },
      demeanor: "冷静",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "ally", summary: "可信的值夜者同事" },
  };

  setScenePresence(draft, {
    reason: "test",
    presentActorIds: ["sherlock", "protagonist", "sherlock"],
    allyActorIds: ["sherlock"],
  });

  // deduped — each id appears once
  assert.equal(draft.public.scene.presentActorIds.length, 2);
  assert.equal(draft.public.allyActorIds.length, 1);
});

void test("setScenePresence rejects allies who are not present", () => {
  const draft = createInitialState();
  draft.public.actors["leonard"] = {
    id: "leonard",
    kind: "human",
    sequence: null,
    identity: { publicIdentity: "诗人", background: "值夜者", roles: [], lockedFacts: [] },
    presentation: {
      canonicalName: "Leonard",
      renderName: "Leonard",
      apparentAge: "20s",
      outfit: { label: "风衣", details: "" },
      demeanor: "随性",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "ally", summary: "同事" },
  };

  // allyActorIds 必须都是 presentActorIds 的子集
  assert.throws(
    () =>
      setScenePresence(draft, {
        reason: "test",
        presentActorIds: ["protagonist"],
        allyActorIds: ["leonard"], // leonard is not present
      }),
    /allyActorIds 中的每个 actor 也必须在 presentActorIds 中/,
  );
});

void test("setScenePresence rejects empty reason", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      setScenePresence(draft, {
        reason: "",
        presentActorIds: ["protagonist"],
        allyActorIds: [],
      }),
    /reason/,
  );
});

// ─── upsertActor (setup-protagonist) ───────────────────────────

void test("upsertActor setup-protagonist writes to protagonistActorId", () => {
  const draft = createInitialState();
  const actor = draft.public.actors["protagonist"]!;
  actor.presentation.canonicalName = "Klein";

  const result = upsertActor(draft, {
    kind: "setup-protagonist",
    reason: "开局角色锁定",
    actor,
  });

  assert.equal(result.message, "actor 已写入：protagonist。");
  assert.equal(draft.public.actors["protagonist"]?.presentation.canonicalName, "Klein");
});

void test("upsertActor setup-protagonist rejects mismatched actor id", () => {
  const draft = createInitialState();
  const actor = draft.public.actors["protagonist"]!;
  actor.id = "someone-else";

  assert.throws(
    () =>
      upsertActor(draft, {
        kind: "setup-protagonist",
        reason: "test",
        actor,
      }),
    /只能写入当前 protagonistActorId/,
  );
});

void test("upsertActor setup-protagonist rejects empty reason", () => {
  const draft = createInitialState();
  const actor = draft.public.actors["protagonist"]!;
  assert.throws(
    () =>
      upsertActor(draft, {
        kind: "setup-protagonist",
        reason: "",
        actor,
      }),
    /reason/,
  );
});

// ─── upsertActor (upsert-public-npc) ───────────────────────────

void test("upsertActor upsert-public-npc creates a public NPC", () => {
  const draft = createInitialState();

  const result = upsertActor(draft, {
    kind: "upsert-public-npc",
    reason: "引入新 NPC",
    npc: {
      id: "leonard",
      kind: "human",
      canonicalName: "Leonard Mitchell",
      publicIdentity: "值夜者诗人",
      apparentAge: "20s",
      outfit: { label: "值夜者制服", details: "黑色制服" },
      demeanor: "随性但敏锐",
      relationshipToProtagonist: { stance: "ally", summary: "值夜者同事" },
      ordinaryItems: [],
    },
  });

  assert.equal(result.message, "public npc 已写入：leonard。");
  assert.ok(draft.public.actors["leonard"] !== undefined);
  assert.equal(draft.public.actors["leonard"]?.presentation.canonicalName, "Leonard Mitchell");
  assert.equal(draft.public.actors["leonard"]?.kind, "human");
});

void test("upsertActor upsert-public-npc creates a beyonder NPC with creature kind", () => {
  const draft = createInitialState();

  upsertActor(draft, {
    kind: "upsert-public-npc",
    reason: "引入非凡生物",
    npc: {
      id: "creature-01",
      kind: "creature",
      canonicalName: "未知存在",
      publicIdentity: "封印物",
      apparentAge: "未知",
      outfit: { label: "不详", details: "" },
      demeanor: "危险",
      relationshipToProtagonist: { stance: "hostile", summary: "具有强烈敌意" },
      ordinaryItems: [],
    },
  });

  const actor = draft.public.actors["creature-01"]!;
  assert.equal(actor.kind, "creature");
  if (actor.kind === "creature") {
    assert.equal(actor.origin, "玩家可见信息未确认");
  }
  // beyonder flag: condition.afflictions is empty; no sequence set
  assert.deepEqual(actor.condition.afflictions, []);
});

void test("upsertActor upsert-public-npc rejects empty publicIdentity", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      upsertActor(draft, {
        kind: "upsert-public-npc",
        reason: "test",
        npc: {
          id: "bad",
          kind: "human",
          canonicalName: "Bad",
          publicIdentity: "",
          apparentAge: "20s",
          outfit: { label: "x", details: "" },
          demeanor: "x",
          ordinaryItems: [],
          relationshipToProtagonist: { stance: "neutral", summary: "test" },
        },
      }),
    /publicIdentity/,
  );
});

// ─── upsertActor (init-npc) ────────────────────────────────────

void test("upsertActor init-npc creates a skeleton NPC", () => {
  const draft = createInitialState();

  const result = upsertActor(draft, {
    kind: "init-npc",
    reason: "快速初始化 NPC 骨架",
    npc: {
      actorId: "stranger",
      canonicalName: "陌生人",
      publicIdentity: "身份不明的路人",
    },
  });

  assert.equal(result.message, "public npc skeleton 已写入：stranger。");
  const actor = draft.public.actors["stranger"]!;
  assert.equal(actor.kind, "human");
  assert.equal(actor.presentation.apparentAge, "玩家可见年龄未确认");
  assert.deepEqual(actor.presentation.outfit, {
    label: "玩家可见外观未确认",
    details: "玩家可见外观未确认",
  });
  assert.equal(actor.presentation.demeanor, "玩家可见举止未确认");
  assert.equal(actor.relationshipToProtagonist.stance, "neutral");
});

void test("upsertActor init-npc does not overwrite existing actor", () => {
  const draft = createInitialState();
  // actor already exists with different data
  draft.public.actors["existing"] = {
    id: "existing",
    kind: "human",
    sequence: null,
    identity: { publicIdentity: "已存在的 NPC", background: "已存在", roles: [], lockedFacts: [] },
    presentation: {
      canonicalName: "Existing",
      renderName: "Existing",
      apparentAge: "40s",
      outfit: { label: "old", details: "" },
      demeanor: "old",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "neutral", summary: "old" },
  };

  const result = upsertActor(draft, {
    kind: "init-npc",
    reason: "尝试覆盖",
    npc: {
      actorId: "existing",
      canonicalName: "Should Not Replace",
      publicIdentity: "覆盖失败",
    },
  });

  // Does NOT overwrite — returns message saying actor exists
  assert.equal(result.message, "actor 已存在：existing。");
  assert.equal(draft.public.actors["existing"]?.presentation.canonicalName, "Existing");
});

// ─── upsertActor (upsert-sequence) ────────────────────────────────

void test("upsertActor upsert-sequence sets sequence info on existing actor", () => {
  const draft = createInitialState();

  const result = upsertActor(draft, {
    kind: "upsert-sequence",
    reason: "确认序列晋升",
    sequence: {
      actorId: "protagonist",
      currentSequence: "序列9：观众",
      rank: "seq-9",
      pathway: "reader",
      promotionSystem: "potion",
    },
  });

  assert.equal(result.message, "序列已更新：protagonist → 序列9：观众 (reader)。");
  const actor = draft.public.actors["protagonist"]!;
  assert.equal(actor.sequence?.currentSequence, "序列9：观众");
  assert.equal(actor.sequence?.rank, "seq-9");
});

void test("upsertActor upsert-sequence throws on missing actor", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      upsertActor(draft, {
        kind: "upsert-sequence",
        reason: "测试",
        sequence: {
          actorId: "nonexistent",
          currentSequence: "序列9",
          rank: "seq-9",
          pathway: "reader",
          promotionSystem: "potion",
        },
      }),
    /actor 不存在，无法设置序列/,
  );
});

// ─── retireActor ────────────────────────────────────────────────

void test("retireActor removes actor and cleans up registries", () => {
  const draft = createInitialState();
  // add a non-protagonist actor
  draft.public.actors["dunn"] = {
    id: "dunn",
    kind: "human",
    sequence: null,
    identity: {
      publicIdentity: "值夜者队长",
      background: "值夜者高层",
      roles: [],
      lockedFacts: [],
    },
    presentation: {
      canonicalName: "Dunn Smith",
      renderName: "Dunn Smith",
      apparentAge: "40s",
      outfit: { label: "制服", details: "值夜者队长制服" },
      demeanor: "威严",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "ally", summary: "上司" },
  };
  // put him in scene
  draft.public.scene.presentActorIds = ["protagonist", "dunn"];
  draft.public.allyActorIds = ["dunn"];

  const result = retireActor(draft, { actorId: "dunn", reason: "剧情退场" });

  assert.match(result.message, /actor 已退场/);
  assert.equal(draft.public.actors["dunn"], undefined);
  assert.equal(draft.public.scene.presentActorIds.includes("dunn"), false);
  assert.equal(draft.public.allyActorIds.includes("dunn"), false);
});

void test("retireActor throws on protagonist", () => {
  const draft = createInitialState();
  assert.throws(
    () => retireActor(draft, { actorId: "protagonist", reason: "test" }),
    /不能 retire protagonist/,
  );
});

void test("retireActor throws on missing actor", () => {
  const draft = createInitialState();
  assert.throws(
    () => retireActor(draft, { actorId: "nonexistent", reason: "test" }),
    /actor 不存在，无法 retire/,
  );
});

void test("retireActor throws when actor owns tracked items", () => {
  const draft = createInitialState();
  draft.public.actors["dunn"] = {
    id: "dunn",
    kind: "human",
    sequence: null,
    identity: { publicIdentity: "队长", background: "值夜者", roles: [], lockedFacts: [] },
    presentation: {
      canonicalName: "Dunn",
      renderName: "Dunn",
      apparentAge: "40s",
      outfit: { label: "制服", details: "" },
      demeanor: "威严",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "ally", summary: "上司" },
  };
  // give him a tracked item
  const trackedItem: import("../state/state.ts").TrackedItemState = {
    id: "seal-artifact-01",
    kind: "sealed-artifact",
    label: "封印物 2-049",
    ownerActorId: "dunn",
    holderActorId: "dunn",
    location: null,
    condition: "intact",
    visibility: "player-known",
    notes: [],
  };
  draft.public.trackedItems["seal-artifact-01"] = trackedItem;

  assert.throws(
    () => retireActor(draft, { actorId: "dunn", reason: "test" }),
    /仍持有.*tracked item/,
  );
});

void test("retireActor throws when actor owns a purse", () => {
  const draft = createInitialState();
  draft.public.actors["roselle"] = {
    id: "roselle",
    kind: "human",
    sequence: null,
    identity: { publicIdentity: "前值夜者", background: "背景", roles: [], lockedFacts: [] },
    presentation: {
      canonicalName: "Roselle",
      renderName: "Roselle",
      apparentAge: "30s",
      outfit: { label: "便服", details: "" },
      demeanor: "警惕",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "neutral", summary: "旧识" },
  };
  draft.public.economy.accessibleFunds.push({
    id: "purse-roselle",
    ownerActorId: "roselle",
    label: "Roselle 的资金",
    amount: 100,
    currencyType: "loen",
    access: "held",
  });

  assert.throws(() => retireActor(draft, { actorId: "roselle", reason: "test" }), /仍拥有资金账户/);
});

void test("retireActor throws when actor has outstanding debts", () => {
  const draft = createInitialState();
  draft.public.actors["oath"] = {
    id: "oath",
    kind: "human",
    sequence: null,
    identity: { publicIdentity: "欠债者", background: "背景", roles: [], lockedFacts: [] },
    presentation: {
      canonicalName: "Oath",
      renderName: "Oath",
      apparentAge: "20s",
      outfit: { label: "旧衣", details: "" },
      demeanor: "焦虑",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "neutral", summary: "欠债者" },
  };
  draft.public.economy.debts.push({
    id: "debt-oath-01",
    debtorActorId: "oath",
    creditor: "银行",
    amount: 500,
    reason: "贷款",
  });

  assert.throws(() => retireActor(draft, { actorId: "oath", reason: "test" }), /仍背负债务/);
});

void test("removeActorEverywhere cleans impressions and relationship signals", () => {
  const draft = createInitialState();
  draft.public.actors["dunn"] = {
    id: "dunn",
    kind: "human",
    sequence: null,
    identity: { publicIdentity: "队长", background: "值夜者", roles: [], lockedFacts: [] },
    presentation: {
      canonicalName: "Dunn",
      renderName: "Dunn",
      apparentAge: "40s",
      outfit: { label: "制服", details: "" },
      demeanor: "威严",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "ally", summary: "上司" },
  };
  // add impression
  draft.public.actorImpressions["dunn"] = {
    actorId: "dunn",
    presence: "威严的值夜者队长",
    actionStyle: "沉稳",
    relationshipPosture: "可靠的上司",
    voiceMaterial: "沉默寡言",
    updatedAt: draft.public.clock.currentAt,
  };
  // add relationship signal involving this actor
  draft.public.relationshipSignals.push({
    id: "signal-01",
    actorId: "dunn",
    targetActorId: "protagonist",
    signal: "信任",
    interpretation: "依赖",
    boundary: "professional",
    sourceEventId: null,
    visibility: "player-known",
  });
  // add relationship signal where actor is target
  draft.secrets.relationshipSignals.push({
    id: "signal-02",
    actorId: "protagonist",
    targetActorId: "dunn",
    signal: "怀疑",
    interpretation: "不信任",
    boundary: "professional",
    sourceEventId: null,
    visibility: "secret",
  });
  // add secret state
  draft.secrets.actorStates["dunn"] = { actorId: "dunn" };

  removeActorEverywhere(draft, "dunn");

  assert.equal(draft.public.actors["dunn"], undefined);
  assert.equal(draft.public.actorImpressions["dunn"], undefined);
  assert.equal(draft.secrets.actorStates["dunn"], undefined);
  // relationship signals involving dunn are gone
  assert.equal(
    draft.public.relationshipSignals.find(
      (s) => s.actorId === "dunn" || s.targetActorId === "dunn",
    ),
    undefined,
  );
  assert.equal(
    draft.secrets.relationshipSignals.find(
      (s) => s.actorId === "dunn" || s.targetActorId === "dunn",
    ),
    undefined,
  );
});
