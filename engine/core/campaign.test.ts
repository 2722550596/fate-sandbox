import assert from "node:assert/strict";
import test from "node:test";

import { configureCampaign } from "./campaign";
import { commitState, exportState, createInitialState } from "./state-store";

void test("configureCampaign applies FSF Snowfield preset", () => {
  const draft = createInitialState();

  const result = configureCampaign(draft, {
    presetId: "fsf_2008_snowfield",
    currentAt: "2008-06-03T03:28:00.000Z",
    premise: "2008 年斯诺菲尔德，绫香·沙条召唤到的 Saber 是两仪式。",
    reason: "测试切换到 FSF 斯诺菲尔德线",
  });

  const state = draft;
  assert.equal(result.message, "Campaign 已配置：Fate/strange Fake 沙盒 (fsf, America/Denver)。");
  assert.equal(state.public.campaign.timeline, "fsf");
  assert.equal(state.public.clock.timezone, "America/Denver");
  assert.equal(state.public.clock.currentAt, "2008-06-03T03:28:00.000Z");
  assert.equal(state.public.scene.location.region, "斯诺菲尔德");
  assert.equal(state.public.economy.currency, "USD");
  assert.equal(state.public.economy.accessibleFunds[0]?.amount, 200);
  commitState(draft);
  assert.equal(exportState().public.clock.displayTime, "2008年06月02日 星期一 21:28");
});

void test("configureCampaign applies Fate EXTRA SE.RA.PH preset", () => {
  const draft = createInitialState();

  const result = configureCampaign(draft, {
    presetId: "extra_2032_seraph",
    reason: "测试切换到 Fate/EXTRA SE.RA.PH 线",
  });

  const state = draft;
  assert.equal(result.message, "Campaign 已配置：Fate/EXTRA 沙盒 (extra, UTC)。");
  assert.equal(state.public.campaign.timeline, "extra");
  assert.deepEqual(state.public.campaign.activeRuleSetIds, [
    "fate-worldview-filter",
    "fate-rank-combat",
    "moon-cell-seraph",
  ]);
  assert.equal(state.public.clock.timezone, "UTC");
  assert.equal(state.public.scene.location.region, "Moon Cell");
  assert.equal(state.public.scene.location.site, "SE.RA.PH");
  assert.equal(state.public.scene.location.boundary, "otherworld");
  assert.equal(state.public.economy.currency, "custom");
  commitState(draft);
  assert.equal(exportState().public.clock.displayTime, "2032年01月01日 星期四 00:00");
});

void test("configureCampaign applies Fate EXTRA CCC far side preset", () => {
  const draft = createInitialState();

  const result = configureCampaign(draft, {
    presetId: "extra_ccc_2032_far_side",
    reason: "测试切换到 Fate/EXTRA CCC 月之裏側线",
  });

  const state = draft;
  assert.equal(result.message, "Campaign 已配置：Fate/EXTRA CCC 沙盒 (extra-ccc, UTC)。");
  assert.equal(state.public.campaign.timeline, "extra-ccc");
  assert.deepEqual(state.public.campaign.activeRuleSetIds, [
    "fate-worldview-filter",
    "fate-rank-combat",
    "moon-cell-seraph",
    "moon-cell-far-side",
  ]);
  assert.equal(state.public.clock.timezone, "UTC");
  assert.equal(state.public.scene.location.region, "Moon Cell");
  assert.equal(state.public.scene.location.site, "月之裏側");
  assert.equal(state.public.scene.location.detail, "旧校舍");
  assert.equal(state.public.scene.location.boundary, "otherworld");
  assert.equal(state.public.economy.currency, "custom");
  commitState(draft);
  assert.equal(exportState().public.clock.displayTime, "2032年01月01日 星期四 00:00");
});

void test("configureCampaign rejects unknown preset", () => {
  const draft = createInitialState();

  assert.throws(
    () => configureCampaign(draft, { presetId: "missing", reason: "测试未知 preset" }),
    /campaign preset 不存在: missing/,
  );
});
