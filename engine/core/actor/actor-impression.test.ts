import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import {
  changeActorOutfit,
  formatPresenceImpressionCards,
  presentActorImpressions,
  upsertActorImpression,
} from "./actor-impression.ts";

function addTestNpc(draft: ReturnType<typeof createInitialState>, actorId: string): void {
  draft.public.actors[actorId] = {
    id: actorId,
    kind: "human",
    roles: [],
    sequence: null,
    identity: { publicIdentity: actorId, background: "", lockedFacts: [] },
    presentation: {
      canonicalName: actorId.charAt(0).toUpperCase() + actorId.slice(1),
      renderName: actorId.charAt(0).toUpperCase() + actorId.slice(1),
      apparentAge: "20s",
      outfit: { label: "default", details: "" },
      demeanor: "neutral",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "neutral", summary: "neutral" },
  };
}

void test("upsertActorImpression creates a new impression card", () => {
  const draft = createInitialState();
  addTestNpc(draft, "rin");

  const card = upsertActorImpression(draft, {
    actorId: "rin",
    presence: "Confident and sharp",
    actionStyle: "Direct, analytical, competitive",
    relationshipPosture: "Guarded ally",
    voiceMaterial: "Tsundere edge; formal when serious",
  });

  assert.equal(card.actorId, "rin");
  assert.equal(card.presence, "Confident and sharp");
  assert.equal(Object.keys(draft.public.actorImpressions).length, 1);
});

void test("upsertActorImpression updates existing card", () => {
  const draft = createInitialState();
  addTestNpc(draft, "rin");

  upsertActorImpression(draft, {
    actorId: "rin",
    presence: "Confident",
    actionStyle: "Direct",
    relationshipPosture: "Guarded",
    voiceMaterial: "哼，这点程度的魔术。",
  });

  upsertActorImpression(draft, {
    actorId: "rin",
    presence: "Shaken after battle",
    actionStyle: "Cautious, less decisive",
    relationshipPosture: "Closer, more honest",
    voiceMaterial: "…别误会，我只是。",
  });

  assert.equal(Object.keys(draft.public.actorImpressions).length, 1);
  assert.equal(draft.public.actorImpressions["rin"]?.presence, "Shaken after battle");
});

void test("upsertActorImpression rejects missing actor", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      upsertActorImpression(draft, {
        actorId: "nonexistent",
        presence: "test",
        actionStyle: "test",
        relationshipPosture: "test",
        voiceMaterial: "test",
      }),
    /不存在/,
  );
});

void test("presentActorImpressions returns only in-scene cards", () => {
  const draft = createInitialState();
  addTestNpc(draft, "rin");
  addTestNpc(draft, "sakura");

  upsertActorImpression(draft, {
    actorId: "rin",
    presence: "Confident",
    actionStyle: "Direct",
    relationshipPosture: "Guarded",
    voiceMaterial: "哼。",
  });
  upsertActorImpression(draft, {
    actorId: "sakura",
    presence: "Quiet",
    actionStyle: "Reserved",
    relationshipPosture: "Caring",
    voiceMaterial: "…学长。",
  });

  draft.public.scene.presentActorIds = ["protagonist", "rin"];

  const present = presentActorImpressions(draft);
  assert.equal(present.length, 1);
  assert.equal(present[0]?.actorId, "rin");
});

void test("formatPresenceImpressionCards formats cards for injection", () => {
  const draft = createInitialState();
  addTestNpc(draft, "rin");

  upsertActorImpression(draft, {
    actorId: "rin",
    presence: "Confident and sharp",
    actionStyle: "Direct, analytical",
    relationshipPosture: "Guarded ally",
    voiceMaterial: "Tsundere edge",
  });

  draft.public.scene.presentActorIds = ["protagonist", "rin"];

  const text = formatPresenceImpressionCards(draft);
  assert.ok(text !== null);
  assert.match(text, /Rin/);
  assert.match(text, /Confident and sharp/);
  assert.match(text, /Tsundere edge/);
});

void test("formatPresenceImpressionCards returns null when no NPC present", () => {
  const draft = createInitialState();
  draft.public.scene.presentActorIds = ["protagonist"];
  assert.equal(formatPresenceImpressionCards(draft), null);
});

void test("changeActorOutfit updates actor outfit", () => {
  const draft = createInitialState();
  addTestNpc(draft, "sabre");

  const result = changeActorOutfit(
    draft,
    "sabre",
    {
      label: "战斗装束",
      details: "蓝色礼装，铠甲覆于裙摆之上",
    },
    "进入战斗状态",
  );

  assert.equal(result.message, "外观装备已更新。");
  const actor = draft.public.actors["sabre"];
  assert.equal(actor?.presentation.outfit.label, "战斗装束");
  assert.equal(actor?.presentation.outfit.details, "蓝色礼装，铠甲覆于裙摆之上");
});

void test("changeActorOutfit rejects missing actor", () => {
  const draft = createInitialState();
  assert.throws(
    () =>
      changeActorOutfit(
        draft,
        "nonexistent",
        {
          label: "test",
          details: "test",
        },
        "test",
      ),
    /actor 不存在/,
  );
});
