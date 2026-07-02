import assert from "node:assert/strict";
import test from "node:test";

import { resetState } from "../../core/state/state-store.ts";
import { submitDirectionPacketTool } from "./submit-direction-packet.ts";

const NOOP_SESSION = { appendCustomEntry: () => "test" };

void test("submitDirectionPacketTool accepts meta round without render", () => {
  resetState();

  const result = submitDirectionPacketTool(
    {
      needsRender: false,
      directReply: "收到，正在处理。",
    },
    NOOP_SESSION,
  );

  assert.equal(result.terminate, true);
  assert.match(result.content[0]?.text ?? "", /direction packet 已接收（直答轮）/);
});

void test("submitDirectionPacketTool accepts narrative round with required fields", () => {
  resetState();

  const result = submitDirectionPacketTool(
    {
      needsRender: true,
      playerAction: "继续调查廷根市教堂",
      resolvedChanges: ["进入廷根市教堂外围"],
      npcStances: [],
      endWindow: "教堂门口",
      sensoryAnchors: ["教堂的钟声", "石墙上的苔藓"],
      eventWeight: "normal",
      canonFacts: [],
      suggestedActions: [{ submitText: "推门进入教堂" }],
    },
    NOOP_SESSION,
  );

  assert.equal(result.terminate, true);
  assert.match(result.content[0]?.text ?? "", /direction packet 已接收/);
});

void test("submitDirectionPacketTool rejects missing playerAction in narrative round", () => {
  resetState();

  assert.throws(
    () =>
      submitDirectionPacketTool(
        {
          needsRender: true,
          resolvedChanges: ["测试变化"],
          npcStances: [],
          endWindow: "场景结尾",
          sensoryAnchors: [],
          eventWeight: "light",
          canonFacts: [],
        },
        NOOP_SESSION,
      ),
    /playerAction/,
  );
});

void test("submitDirectionPacketTool rejects missing directReply in meta round", () => {
  resetState();

  assert.throws(
    () =>
      submitDirectionPacketTool(
        {
          needsRender: false,
        },
        NOOP_SESSION,
      ),
    /directReply/,
  );
});
