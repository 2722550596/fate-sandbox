import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { initializeNewGame } from "./new-game-initialization.ts";
import { createInitialState } from "./state-store.ts";

void describe("new game initialization LOTM", () => {
  void it("initializes a human protagonist campaign", () => {
    const draft = createInitialState();
    initializeNewGame(draft, {
      kind: "human-protagonist",
      campaign: { presetId: "tingen_1349" },
      protagonist: {
        internalName: "玩家",
        publicIdentity: "廷根大学的普通学生",
        background: "在廷根大学读书的年轻人，与非凡世界尚无交集。",
        apparentAge: "青年",
        outfit: { label: "日常服装", details: "普通的衬衫和长裤。" },
        demeanor: "带着书卷气的认真。",
      },
      reason: "测试初始化",
    });
    assert.equal(draft.public.actors["protagonist"]?.kind, "human");
    assert.equal(draft.public.protagonistActorId, "protagonist");
  });

  void it("initializes a beyonder protagonist campaign", () => {
    const draft = createInitialState();
    initializeNewGame(draft, {
      kind: "beyonder-protagonist",
      campaign: { presetId: "tingen_1349" },
      protagonist: {
        internalName: "序列9非凡者",
        publicIdentity: "刚完成晋升的非凡者",
        background: "在廷根秘密完成了序列9晋升的新手非凡者。",
        apparentAge: "青年",
        outfit: { label: "深色外套", details: "遮住身体的深色大衣。" },
        demeanor: "带着魔药余味的警觉。",
        currentSequence: "序列9-偷盗者",
        rank: "seq-9",
        pathway: "thief",
      },
      reason: "测试非凡者开局",
    });
    const seq = draft.public.actors["protagonist"]?.sequence;
    assert.equal(seq?.pathway, "thief");
    assert.equal(seq?.rank, "seq-9");
  });
});
