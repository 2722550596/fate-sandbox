import type { TrackedItemState } from "./state.ts";

import assert from "node:assert/strict";
import test from "node:test";

import { buildGmBrief, buildInventoryMarkdown, buildStatusMarkdown } from "./public-projection.ts";
import { createInitialState } from "./state-store.ts";

void test("buildGmBrief throws when protagonist is missing", () => {
  const draft = createInitialState();
  const publicState = draft.public;

  assert.throws(
    () => buildGmBrief({ ...publicState, actors: {} }),
    /GM brief failed: protagonist protagonist missing/,
  );
});

void test("GM brief shows special boundaries; status markdown hides them", () => {
  const draft = createInitialState();
  const publicState = draft.public;
  publicState.scene.location = {
    region: "冬木市",
    site: "深山镇",
    detail: "卫宫邸",
    boundary: "bounded-field",
  };

  assert.match(buildGmBrief(publicState), /地点：冬木市 · 深山镇 · 卫宫邸（bounded-field）/);
  assert.match(buildStatusMarkdown(publicState), /- 地点：冬木市 · 深山镇 · 卫宫邸\n/);

  publicState.scene.location.boundary = "normal";
  assert.match(buildGmBrief(publicState), /地点：冬木市 · 深山镇 · 卫宫邸\n/);

  publicState.scene.location.detail = "";
  assert.match(buildGmBrief(publicState), /地点：冬木市 · 深山镇\n/);
});

void test("GM brief lists only unresolved objectives", () => {
  const draft = createInitialState();
  const publicState = draft.public;
  publicState.scene.objectives = [
    { id: "obj-1", summary: "确认教会的中立立场", status: "active" },
    { id: "obj-2", summary: "已完成的旧目标", status: "resolved" },
    { id: "obj-3", summary: "受阻的调查", status: "blocked" },
  ];

  assert.match(buildGmBrief(publicState), /当前目标：obj-1: 确认教会的中立立场；obj-3: 受阻的调查/);
  assert.doesNotMatch(buildGmBrief(publicState), /已完成的旧目标/);

  publicState.scene.objectives = publicState.scene.objectives.map((objective) => ({
    ...objective,
    status: "resolved" as const,
  }));
  assert.match(buildGmBrief(publicState), /当前目标：无/);
});

void test("scene threats render severity-prefixed in brief and status markdown", () => {
  const draft = createInitialState();
  const publicState = draft.public;

  assert.match(buildGmBrief(publicState), /当前威胁：无/);
  assert.match(buildStatusMarkdown(publicState), /- 威胁：无/);

  publicState.scene.threats = [
    { id: "threat-1", summary: "影子在街区徘徊", severity: "high" },
    { id: "threat-2", summary: "魔力反应残留", severity: "low" },
  ];
  assert.match(buildGmBrief(publicState), /当前威胁：high:影子在街区徘徊；low:魔力反应残留/);
  assert.match(buildStatusMarkdown(publicState), /- 威胁：high: 影子在街区徘徊；low: 魔力反应残留/);
});

void test("GM brief objective routing covers all three branches", () => {
  const draft = createInitialState();
  const publicState = draft.public;

  assert.match(buildGmBrief(publicState), /当前没有可 resolve 的目标/);

  publicState.scene.objectives = [{ id: "obj-1", summary: "调查异变", status: "active" }];
  publicState.scene.storyWindow = null;
  assert.match(
    buildGmBrief(publicState),
    /当前没有 active beat，不要使用 progress_scene_beat complete/,
  );

  publicState.scene.storyWindow = {
    currentArcId: "arc-1",
    currentBeatId: "beat-1",
    title: "夜间的调查",
    allowedActions: ["走访", "观察"],
    forbiddenEscalations: ["直接战斗"],
    completionCriteria: ["找到目击者"],
    nextBeatHints: [],
  };
  const brief = buildGmBrief(publicState);
  assert.match(brief, /active beat 收口用 progress_scene_beat complete/);
  assert.match(
    brief,
    /arc-1\/beat-1《夜间的调查》；允许：走访、观察；禁区：直接战斗；完成：找到目击者/,
  );
});

void test("inventory markdown only lists player-known tracked items", () => {
  const draft = createInitialState();
  const publicState = draft.public;
  publicState.trackedItems = {
    "item-known": buildTrackedItem({
      id: "item-known",
      label: "红宝石吊坠",
      visibility: "player-known",
      holderActorId: "protagonist",
      notes: ["远坂凛交给士郎的回礼"],
    }),
    "item-secret": buildTrackedItem({
      id: "item-secret",
      label: "禁断的圣遗物",
      visibility: "suspected",
      holderActorId: null,
      notes: [],
    }),
  };

  const markdown = buildInventoryMarkdown(publicState);
  assert.match(markdown, /红宝石吊坠/);
  assert.match(markdown, /远坂凛交给士郎的回礼/);
  assert.equal(markdown.includes("禁断的圣遗物"), false);

  const brief = buildGmBrief(publicState);
  assert.match(brief, /关键物品：红宝石吊坠/);
  assert.equal(brief.includes("禁断的圣遗物"), false);
});

void test("inventory markdown reports placeholders for empty funds and items", () => {
  const draft = createInitialState();
  const publicState = draft.public;
  publicState.economy.accessibleFunds = [];
  publicState.trackedItems = {};
  for (const actor of Object.values(publicState.actors)) {
    actor.inventory.ordinaryItems = [];
  }

  const markdown = buildInventoryMarkdown(publicState);
  assert.match(markdown, /- 无可访问资金/);
  assert.match(markdown, /- 无关键物品/);
  assert.match(markdown, /- 无记录/);
});

void test("buildStatusMarkdown lists scene summary with present actor display names", () => {
  const draft = createInitialState();
  const publicState = draft.public;
  publicState.scene.presentActorIds = ["protagonist", "no-such-actor"];

  const markdown = buildStatusMarkdown(publicState);
  assert.match(markdown, /## 当前状态/);
  const protagonistName = publicState.actors["protagonist"]?.presentation.displayName ?? "";
  // 未知 actor 回退为 actor id，已知 actor 用 displayName。
  assert.match(markdown, new RegExp(`- 在场：${protagonistName}、no-such-actor`));
  assert.match(markdown, /## 资源与物品/);
});

function buildTrackedItem(
  overrides: Pick<TrackedItemState, "id" | "label" | "visibility" | "holderActorId" | "notes">,
): TrackedItemState {
  return {
    kind: "mundane",
    ownerActorId: null,
    location: null,
    condition: "intact",
    ...overrides,
  };
}

void test("public projection builders never mutate their input", () => {
  const draft = createInitialState();
  const publicState = draft.public;
  const snapshot = JSON.stringify(publicState);

  buildGmBrief(publicState);
  buildStatusMarkdown(publicState);
  buildInventoryMarkdown(publicState);

  assert.equal(JSON.stringify(publicState), snapshot);
  assert.equal(JSON.stringify(draft.public), snapshot);
});
