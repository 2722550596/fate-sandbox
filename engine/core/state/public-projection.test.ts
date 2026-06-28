import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import { buildGmBrief, buildStatusMarkdown, buildInventoryMarkdown } from "./public-projection.ts";

void test("buildGmBrief returns a multi-line brief with time and location", () => {
  const draft = createInitialState();
  const brief = buildGmBrief(draft.public);

  assert.ok(brief.includes("[当前 GM 简报]"));
  assert.ok(brief.includes("时间"));
  assert.ok(brief.includes("地点"));
  assert.ok(brief.includes("玩家角色"));
});

void test("buildGmBrief throws if protagonist missing", () => {
  const draft = createInitialState();
  delete draft.public.actors[draft.public.protagonistActorId];

  assert.throws(
    () => buildGmBrief(draft.public),
    /protagonist.*missing/,
  );
});

void test("buildStatusMarkdown contains time, location, and scene info", () => {
  const draft = createInitialState();
  const markdown = buildStatusMarkdown(draft.public);

  assert.ok(markdown.includes("当前状态"));
  assert.ok(markdown.includes("时间"));
  assert.ok(markdown.includes("地点"));
  assert.ok(markdown.includes("场景"));
});

void test("buildInventoryMarkdown contains fund and item sections", () => {
  const draft = createInitialState();
  const markdown = buildInventoryMarkdown(draft.public);

  assert.ok(markdown.includes("资源与物品"));
  assert.ok(markdown.includes("资金"));
  assert.ok(markdown.includes("关键物品"));
  assert.ok(markdown.includes("普通随身物"));
});

void test("buildGmBrief shows active obligation warnings", () => {
  const draft = createInitialState();
  draft.public.obligations.push({
    id: "obl-1",
    source: "test",
    kind: "scene-objective",
    summary: "击败敌人",
    createdAt: "2004-01-30T10:00:00.000Z",
  });

  const brief = buildGmBrief(draft.public);

  assert.ok(brief.includes("未清裁决义务"));
  assert.ok(brief.includes("击败敌人"));
});

void test("buildStatusMarkdown shows present actors", () => {
  const draft = createInitialState();
  draft.public.scene.presentActorIds = [draft.public.protagonistActorId];

  const markdown = buildStatusMarkdown(draft.public);

  assert.ok(markdown.includes("在场"));
  assert.ok(markdown.includes("你"));
});