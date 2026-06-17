import assert from "node:assert/strict";
import test from "node:test";

import { scanDirectionPacket } from "./packet-firewall.ts";
import { parseDirectionPacket } from "./packet-schema.ts";

const VALID_RENDER_PACKET = {
  needsRender: true,
  playerAction: "向 Saber 下达突进指令",
  resolvedChanges: ["Saber 突进受阻，被迫转为阵地防守", "消耗一成魔力"],
  npcStances: [
    {
      actorId: "saber_shiki",
      stance: "平静但手腕绷紧",
      wants: "护住御主并寻找破局点",
      refusesToSay: "自己还藏着一张足以终结战斗的底牌",
    },
  ],
  sensoryAnchors: ["灼热气浪", "霜色刀光"],
  endWindow: "玩家必须创造让 Saber 近身的破绽",
  eventWeight: "normal",
  canonFacts: ["Rider 的双枪是概念化的舰队火炮"],
};

void test("parseDirectionPacket accepts a valid render packet", () => {
  const packet = parseDirectionPacket(VALID_RENDER_PACKET, "packet");
  assert.equal(packet.needsRender, true);
  if (packet.needsRender) {
    assert.equal(packet.resolvedChanges.length, 2);
    assert.equal(packet.eventWeight, "normal");
  }
});

void test("parseDirectionPacket accepts suggested UI actions", () => {
  const packet = parseDirectionPacket(
    {
      ...VALID_RENDER_PACKET,
      suggestedActions: [
        { submitText: "我追上去，先观察对方路线。" },
        { submitText: "我先检查刚才留下的痕迹。" },
      ],
    },
    "packet",
  );
  assert.equal(packet.needsRender, true);
  if (packet.needsRender) {
    assert.equal(packet.suggestedActions?.[0]?.submitText, "我追上去，先观察对方路线。");
  }
});

void test("parseDirectionPacket rejects too many suggested UI actions", () => {
  assert.throws(
    () =>
      parseDirectionPacket(
        {
          ...VALID_RENDER_PACKET,
          suggestedActions: [
            { submitText: "A" },
            { submitText: "B" },
            { submitText: "C" },
            { submitText: "D" },
            { submitText: "E" },
          ],
        },
        "packet",
      ),
    /suggestedActions/,
  );
});

void test("scanDirectionPacket blocks secret in suggested action submitText", () => {
  const packet = parseDirectionPacket(
    {
      ...VALID_RENDER_PACKET,
      suggestedActions: [{ submitText: "我说出两仪式的名字。" }],
    },
    "packet",
  );
  const verdict = scanDirectionPacket(packet, ["两仪式"]);
  assert.equal(verdict.kind, "blocked");
  if (verdict.kind === "blocked") {
    assert.equal(verdict.findings[0]?.path, "suggestedActions[0].submitText");
  }
});

void test("parseDirectionPacket accepts a direct reply packet", () => {
  const packet = parseDirectionPacket(
    { needsRender: false, directReply: "这是 OOC 解答。" },
    "packet",
  );
  assert.equal(packet.needsRender, false);
  if (!packet.needsRender) {
    assert.equal(packet.directReply, "这是 OOC 解答。");
  }
});

void test("parseDirectionPacket rejects render packet with empty resolvedChanges", () => {
  assert.throws(
    () => parseDirectionPacket({ ...VALID_RENDER_PACKET, resolvedChanges: [] }, "packet"),
    /resolvedChanges/,
  );
});

void test("parseDirectionPacket rejects missing needsRender", () => {
  const { needsRender: _needsRender, ...rest } = VALID_RENDER_PACKET;
  assert.throws(() => parseDirectionPacket(rest, "packet"), /needsRender/);
});

void test("parseDirectionPacket rejects invalid eventWeight", () => {
  assert.throws(
    () => parseDirectionPacket({ ...VALID_RENDER_PACKET, eventWeight: "epic" }, "packet"),
    /eventWeight/,
  );
});

void test("parseDirectionPacket rejects direct packet with empty reply", () => {
  assert.throws(
    () => parseDirectionPacket({ needsRender: false, directReply: "  " }, "packet"),
    /directReply/,
  );
});

void test("parseDirectionPacket strips unknown fields and trims strings", () => {
  const packet = parseDirectionPacket(
    { ...VALID_RENDER_PACKET, playerAction: "  行动  ", secretNote: "不该在" },
    "packet",
  );
  if (packet.needsRender) {
    assert.equal(packet.playerAction, "行动");
  }
  assert.ok(!("secretNote" in packet));
});

void test("scanDirectionPacket passes a clean packet", () => {
  const packet = parseDirectionPacket(VALID_RENDER_PACKET, "packet");
  assert.deepEqual(scanDirectionPacket(packet, ["两仪式"]), { kind: "pass" });
});

void test("scanDirectionPacket blocks secret in refusesToSay with field path", () => {
  const packet = parseDirectionPacket(
    {
      ...VALID_RENDER_PACKET,
      npcStances: [
        {
          actorId: "saber_shiki",
          stance: "平静",
          wants: "保密",
          refusesToSay: "自己的真名是两仪式",
        },
      ],
    },
    "packet",
  );
  const verdict = scanDirectionPacket(packet, ["两仪式"]);
  assert.equal(verdict.kind, "blocked");
  if (verdict.kind === "blocked") {
    assert.equal(verdict.findings.length, 1);
    assert.equal(verdict.findings[0]?.path, "npcStances[0].refusesToSay");
    assert.equal(verdict.findings[0]?.secret, "两仪式");
  }
});

void test("scanDirectionPacket blocks secret in resolvedChanges and canonFacts", () => {
  const packet = parseDirectionPacket(
    {
      ...VALID_RENDER_PACKET,
      resolvedChanges: ["两仪式 出刀"],
      canonFacts: ["隐藏宝具「唯识·直死之魔眼」尚未公开"],
    },
    "packet",
  );
  const verdict = scanDirectionPacket(packet, ["两仪式", "唯识·直死之魔眼"]);
  assert.equal(verdict.kind, "blocked");
  if (verdict.kind === "blocked") {
    assert.deepEqual(verdict.findings.map((f) => f.path).toSorted(), [
      "canonFacts[0]",
      "resolvedChanges[0]",
    ]);
  }
});

void test("scanDirectionPacket scans direct replies too", () => {
  const packet = parseDirectionPacket(
    { needsRender: false, directReply: "她的真名是两仪式。" },
    "packet",
  );
  assert.equal(scanDirectionPacket(packet, ["两仪式"]).kind, "blocked");
});
