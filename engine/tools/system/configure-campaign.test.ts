import assert from "node:assert/strict";
import test from "node:test";

import { exportState, resetState } from "../../core/state/state-store.ts";
import { configureCampaignTool } from "./configure-campaign.ts";

void test("configureCampaignTool applies LOTM Tingen preset", () => {
  resetState();

  const result = configureCampaignTool(
    {
      presetId: "tingen_1349",
      currentAt: "1349-01-01T07:00:00.000Z",
      premise: "第五纪1349年，廷根市，玩家角色刚刚成为一名非凡者。",
      reason: "新游戏初始化廷根线。",
    },
    createNoopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /Campaign 已配置/);
  const state = exportState();
  assert.equal(state.public.campaign.timeline, "tingen");
  assert.equal(state.public.clock.timezone, "UTC");
});

void test("configureCampaignTool normalizes currency aliases", () => {
  resetState();

  configureCampaignTool(
    {
      presetId: "backlund_1350",
      title: "贝克兰德的阴影",
      currency: "gold-pound",
      reason: "测试货币别名归一化。",
    },
    createNoopSessionManager(),
  );

  assert.equal(exportState().public.economy.currency, "gold-pound");
});

void test("configureCampaignTool rejects unknown timeline with allowed values in Chinese", () => {
  resetState();

  assert.throws(
    () =>
      configureCampaignTool(
        { presetId: "tingen_1349", timeline: "fgo", reason: "测试非法时间线。" },
        createNoopSessionManager(),
      ),
    (error: unknown) => {
      const message = String(error);
      return (
        message.includes("timeline") &&
        message.includes("必须是允许值之一")
      );
    },
  );
});

void test("configureCampaignTool rejects missing reason with required-field error", () => {
  resetState();

  assert.throws(
    () => configureCampaignTool({ presetId: "tingen_1349" }, createNoopSessionManager()),
    (error: unknown) => String(error).includes("缺少必填字段") && String(error).includes("reason"),
  );
});

void test("configureCampaignTool converts numeric strings and trims whitespace input", () => {
  resetState();

  configureCampaignTool(
    {
      presetId: "tingen_1349",
      startingFunds: "800",
      currency: "  penny  ",
      reason: "  测试 Convert coercion 与 trim。  ",
    },
    createNoopSessionManager(),
  );

  const state = exportState();
  assert.equal(state.public.economy.accessibleFunds[0]?.amount, 800);
  assert.equal(state.public.economy.currency, "penny");
});

function createNoopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}