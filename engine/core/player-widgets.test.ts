import type { PublicActorState } from "./state.ts";

import assert from "node:assert/strict";
import test from "node:test";

import { upsertActorImpression } from "./actor-impression.ts";
import {
  buildHooksMarkdown,
  buildJournalMarkdown,
  buildRecapMarkdown,
  buildRelationsMarkdown,
} from "./player-widgets.ts";
import { createInitialState } from "./state-store.ts";

function addTestNpc(
  draft: ReturnType<typeof createInitialState>,
  actorId: string,
  stance: string,
): void {
  const actor: PublicActorState = {
    id: actorId,
    kind: "human",
    roles: [],
    magecraft: null,
    servantForm: null,
    identity: { publicIdentity: actorId, background: "", lockedFacts: [] },
    presentation: {
      internalName: actorId.charAt(0).toUpperCase() + actorId.slice(1),
      renderName: actorId.charAt(0).toUpperCase() + actorId.slice(1),
      apparentAge: "20s",
      outfit: { label: "default", details: "" },
      demeanor: "neutral",
    },
    condition: { wounds: [], afflictions: [], permanentEffects: [] },
    inventory: { ordinaryItems: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "neutral", summary: stance },
  };
  draft.public.actors[actorId] = actor;
}

// ─── /relations ──────────────────────────────────────────────────

void test("buildRelationsMarkdown shows allies and present NPCs", () => {
  const draft = createInitialState();
  addTestNpc(draft, "rin", "Guarded ally");
  addTestNpc(draft, "shinji", "Hostile rival");
  draft.public.allyActorIds = ["rin"];
  draft.public.scene.presentActorIds = ["protagonist", "rin", "shinji"];

  const md = buildRelationsMarkdown(draft.public);

  assert.match(md, /同行者/);
  assert.match(md, /Rin.*Guarded ally/);
  assert.match(md, /当前在场/);
  assert.match(md, /Shinji.*Hostile rival/);
});

void test("buildRelationsMarkdown shows impression cards for present actors", () => {
  const draft = createInitialState();
  addTestNpc(draft, "rin", "Ally");
  draft.public.scene.presentActorIds = ["protagonist", "rin"];

  upsertActorImpression(draft, {
    actorId: "rin",
    presence: "Sharp and confident",
    actionStyle: "Direct",
    relationshipPosture: "Guarded",
    voiceMaterial: "Tsundere edge",
  });

  const md = buildRelationsMarkdown(draft.public);

  assert.match(md, /印象/);
  assert.match(md, /Sharp and confident/);
  assert.match(md, /Tsundere edge/);
});

void test("buildRelationsMarkdown shows recent relationship signals", () => {
  const draft = createInitialState();
  addTestNpc(draft, "rin", "Ally");
  draft.public.relationshipSignals.push({
    id: "sig-1",
    actorId: "rin",
    targetActorId: "protagonist",
    signal: "Protected protagonist in battle",
    interpretation: "Trust growing",
    boundary: "Would not sacrifice self yet",
    sourceEventId: null,
    visibility: "player-known",
  });

  const md = buildRelationsMarkdown(draft.public);

  assert.match(md, /关系变化/);
  assert.match(md, /Protected protagonist/);
  assert.match(md, /Trust growing/);
});

// ─── /hooks ──────────────────────────────────────────────────────

void test("buildHooksMarkdown shows hooks by category", () => {
  const draft = createInitialState();
  draft.public.hooks.push(
    {
      id: "h1",
      label: "柳洞寺结界异变",
      status: "active",
      lastSurfacedAt: "",
      surfaceCount: 3,
      lastNovelty: "",
    },
    {
      id: "h2",
      label: "教会地下室",
      status: "parked",
      lastSurfacedAt: "",
      surfaceCount: 1,
      lastNovelty: "",
    },
    {
      id: "h3",
      label: "初遇 Lancer",
      status: "paid",
      lastSurfacedAt: "",
      surfaceCount: 2,
      lastNovelty: "",
    },
  );

  const md = buildHooksMarkdown(draft.public);

  assert.match(md, /活跃/);
  assert.match(md, /柳洞寺结界异变/);
  assert.match(md, /暂搁/);
  assert.match(md, /教会地下室/);
  assert.match(md, /已结/);
  assert.match(md, /初遇 Lancer/);
});

void test("buildHooksMarkdown shows empty message", () => {
  const draft = createInitialState();
  const md = buildHooksMarkdown(draft.public);
  assert.match(md, /暂无追踪/);
});

// ─── /journal ────────────────────────────────────────────────────

void test("buildJournalMarkdown shows events and turn log", () => {
  const draft = createInitialState();
  draft.public.memory.eventLog.push({
    id: "evt-1",
    time: "2004-01-30T10:00:00.000Z",
    title: "First encounter",
    summary: "Met Rin at school gate",
    consequences: ["alliance formed"],
  });
  draft.public.turnLog.push({
    id: "turn-1",
    summary: "Investigated the gate",
    startedAt: "2004-01-30T09:00:00.000Z",
    endedAt: "2004-01-30T10:00:00.000Z",
    time: { kind: "elapsed", elapsedMinutes: 60, reason: "investigation" },
    eventCount: 1,
    resultCount: 1,
  });

  const md = buildJournalMarkdown(draft.public);

  assert.match(md, /重大事件/);
  assert.match(md, /First encounter/);
  assert.match(md, /alliance formed/);
  assert.match(md, /回合记录/);
  assert.match(md, /Investigated the gate/);
});

// ─── /recap ──────────────────────────────────────────────────────

void test("buildRecapMarkdown shows campaign overview", () => {
  const draft = createInitialState();
  draft.public.hooks.push({
    id: "h1",
    label: "柳洞寺结界",
    status: "active",
    lastSurfacedAt: "",
    surfaceCount: 2,
    lastNovelty: "",
  });
  draft.public.memory.eventLog.push({
    id: "evt-1",
    time: "2004-01-30T10:00:00.000Z",
    title: "Summoning",
    summary: "Summoned Saber accidentally",
    consequences: [],
  });

  const md = buildRecapMarkdown(draft.public);

  assert.match(md, /前情提要/);
  assert.match(md, /Fate 叙事/);
  assert.match(md, /protagonist/i);
  assert.match(md, /Summoning/);
  assert.match(md, /当前悬念/);
  assert.match(md, /柳洞寺结界/);
  assert.match(md, /当前场景/);
});
