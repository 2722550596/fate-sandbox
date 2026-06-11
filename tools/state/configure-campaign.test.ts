import assert from "node:assert/strict";
import test from "node:test";

import { exportState, resetState } from "../../engine/core/state-store.ts";
import { configureCampaignTool } from "./configure-campaign.ts";

void test("configureCampaignTool updates campaign and timezone", () => {
  resetState();

  const result = configureCampaignTool(
    {
      presetId: "fsf_2008_snowfield",
      currentAt: "2008-06-03T03:28:00.000Z",
      premise: "2008 年斯诺菲尔德，绫香·沙条召唤到的 Saber 是两仪式。",
      reason: "当前游戏已确定为 FSF 斯诺菲尔德替换 Saber 线。",
    },
    createNoopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /Campaign 已配置/);
  const state = exportState();
  assert.equal(state.public.campaign.timeline, "fsf");
  assert.equal(state.public.clock.timezone, "America/Denver");
  assert.equal(state.public.clock.displayTime, "2008年06月02日 星期一 21:28");
});

void test("configureCampaignTool normalizes Moon Cell currency aliases", () => {
  resetState();

  configureCampaignTool(
    {
      presetId: "extra_ccc_2032_far_side",
      title: "月之海的残响",
      currency: "PPT",
      reason: "测试 Moon Cell 货币别名归一化。",
    },
    createNoopSessionManager(),
  );

  assert.equal(exportState().public.economy.currency, "custom");
});

void test("configureCampaignTool rejects unknown timeline with allowed values in Chinese", () => {
  resetState();

  assert.throws(
    () =>
      configureCampaignTool(
        { presetId: "fsn_2004_fuyuki", timeline: "fgo", reason: "测试非法时间线。" },
        createNoopSessionManager(),
      ),
    (error: unknown) => {
      const message = String(error);
      return (
        message.includes("timeline") &&
        message.includes("必须是允许值之一") &&
        message.includes("fsf")
      );
    },
  );
});

void test("configureCampaignTool rejects missing reason with required-field error", () => {
  resetState();

  assert.throws(
    () => configureCampaignTool({ presetId: "fsn_2004_fuyuki" }, createNoopSessionManager()),
    (error: unknown) => String(error).includes("缺少必填字段") && String(error).includes("reason"),
  );
});

void test("configureCampaignTool converts numeric strings and trims whitespace input", () => {
  resetState();

  configureCampaignTool(
    {
      presetId: "fsn_2004_fuyuki",
      startingFunds: "80000",
      currency: "  PPT  ",
      reason: "  测试 Convert coercion 与 trim。  ",
    },
    createNoopSessionManager(),
  );

  const state = exportState();
  assert.equal(state.public.economy.accessibleFunds[0]?.amount, 80000);
  assert.equal(state.public.economy.currency, "custom");
});

function createNoopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}
