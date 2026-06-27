import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/state-store.ts";
import {
  buildBackstageContextBlock,
  buildBackstageDirectorPrompt,
} from "./backstage-director-prompt.ts";

void test("buildBackstageDirectorPrompt composes persona + safe context + assembled input", () => {
  const draft = createInitialState();

  const prompt = buildBackstageDirectorPrompt(draft, {
    lineId: "caster-ryudou",
    timeWindow: { start: "2004-01-30T21:00:00.000Z", end: "2004-01-30T23:00:00.000Z" },
  });

  // persona (single source of truth) travels inside the prompt
  assert.match(prompt, /backstage-world/);
  assert.match(prompt, /## Output contract/);
  // hermetic framing replaced the subagent-only agentScope coupling
  assert.match(prompt, /detached, hermetic process/);
  assert.doesNotMatch(prompt, /agentScope: "project"/);
  // safe projection block present and closed
  assert.match(prompt, /<timeline_state_context>/);
  assert.match(prompt, /<\/timeline_state_context>/);
  // assembled ParallelLineInput delivered
  assert.match(prompt, /ParallelLineInput:/);
  assert.match(prompt, /"lineId": "caster-ryudou"/);
  // closing instruction enforces bare JSON
  assert.match(prompt, /Return the ParallelLineOutput JSON now/);
  assert.match(prompt, /first character `\{`/);
});

void test("buildBackstageDirectorPrompt carries privateFacts (hidden knowledge by design)", () => {
  const draft = createInitialState();
  draft.secrets.campaignSecrets.push({
    id: "secret-1",
    text: "Caster secretly drains townsfolk prana",
    relatedActorIds: [],
    revealState: "hidden",
  });

  const prompt = buildBackstageDirectorPrompt(draft, {
    lineId: "caster-ryudou",
    timeWindow: { start: "2004-01-30T21:00:00.000Z", end: "2004-01-30T23:00:00.000Z" },
  });

  // firewall posture: the hermetic director IS fed hidden facts on purpose
  assert.match(prompt, /Caster secretly drains townsfolk prana/);
});

void test("buildBackstageContextBlock is a closed, secret-free safe projection", () => {
  const draft = createInitialState();
  draft.secrets.campaignSecrets.push({
    id: "secret-2",
    text: "hidden grail corruption codeword zzz-secret",
    relatedActorIds: [],
    revealState: "hidden",
  });

  const block = buildBackstageContextBlock(draft);

  assert.ok(block.startsWith("<timeline_state_context>"));
  assert.ok(block.trimEnd().endsWith("</timeline_state_context>"));
  // the SAFE projection must not carry raw campaign secrets
  assert.doesNotMatch(block, /zzz-secret/);
});
