import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { initializeNewGame } from "./new-game-initialization.ts";
import { createInitialState } from "./state-store.ts";

const PLAIN_OUTFIT = { label: "日常服装", details: "便于行动的普通衣物。" };

void describe("initializeNewGame", () => {
  void it("initializes a human protagonist campaign recipe", () => {
    const draft = createInitialState();
    const result = initializeNewGame(draft, {
      kind: "human-protagonist",
      campaign: { presetId: "fsn_2004_fuyuki" },
      protagonist: {
        displayName: "你",
        publicIdentity: "不了解魔术的本地学生",
        background: "在冬木的异常夜晚前仍过着普通生活。",
        apparentAge: "高中生",
        outfit: PLAIN_OUTFIT,
        demeanor: "被异常逼到必须行动。",
        ordinaryItems: ["学生证", "手机"],
      },
      presence: { presentActorIds: ["protagonist"] },
      knownFacts: [{ scope: "protagonist", text: "你不知道圣杯战争规则。" }],
      reason: "新手模式初始化普通人 protagonist",
    });

    const state = draft;
    const protagonist = state.public.actors["protagonist"];

    assert.deepEqual(result.steps, [
      "reset-state",
      "configure-campaign",
      "setup-human-protagonist",
      "set-scene-presence",
      "record-known-fact",
    ]);
    assert.equal(state.public.campaign.timeline, "fsn");
    assert.equal(protagonist?.identity.publicIdentity, "不了解魔术的本地学生");
    assert.equal(protagonist?.servantForm, null);
    assert.deepEqual(state.public.scene.presentActorIds, ["protagonist"]);
    assert.equal(
      state.public.memory.pinnedFacts.some((fact) => fact.text === "你不知道圣杯战争规则。"),
      true,
    );
  });

  void it("initializes servant protagonist secrets without revealing true name publicly", () => {
    const draft = createInitialState();
    initializeNewGame(draft, {
      kind: "servant-protagonist",
      campaign: { presetId: "fsf_2008_snowfield" },
      protagonist: {
        displayName: "Saber",
        publicIdentity: "刚现界且真名未公开的 Saber",
        apparentAge: "青年",
        outfit: { label: "战斗礼装", details: "灵基投影出的轻甲。" },
        demeanor: "警戒而克制。",
        className: "Saber",
        trueNameDisplay: "Saber",
        trueNameStatus: "hidden",
      },
      hiddenTrueName: {
        value: "隐藏真名",
        revealConditions: ["剧情内提出可验证证据"],
      },
      reason: "初始化玩家从者且隐藏真名",
    });

    const state = draft;
    const protagonist = state.public.actors["protagonist"];

    assert.equal(protagonist?.servantForm?.identity.trueName.status, "hidden");
    assert.equal(protagonist?.servantForm?.identity.trueName.display, "Saber");
    assert.notEqual(state.secrets.actorSecrets["protagonist"], undefined);
  });
});
