import assert from "node:assert/strict";
import test from "node:test";

import { parsePromptPreset } from "./preset.ts";

void test("parsePromptPreset accepts file and runtime sources", () => {
  const preset = parsePromptPreset(
    {
      version: 1,
      modules: [
        {
          id: "world",
          enabled: true,
          slot: "pre-history",
          priority: 10,
          header: "world_context",
          source: "agents/gm-context.md",
        },
        {
          id: "state",
          enabled: false,
          slot: "pre-response",
          priority: 20,
          header: "mechanical_state",
          source: "runtime:state-brief",
        },
      ],
    },
    "test-preset.json",
  );

  assert.equal(preset.version, 1);
  assert.equal(preset.modules.length, 2);
  assert.deepEqual(preset.modules[0]?.source, { kind: "file", path: "agents/gm-context.md" });
  assert.deepEqual(preset.modules[1]?.source, { kind: "runtime", name: "state-brief" });
});

void test("parsePromptPreset rejects unsafe file sources", () => {
  assert.throws(
    () =>
      parsePromptPreset(
        {
          version: 1,
          modules: [
            {
              id: "bad",
              enabled: true,
              slot: "pre-history",
              priority: 10,
              header: "bad_tag",
              source: "../secret.md",
            },
          ],
        },
        "test-preset.json",
      ),
    /source must be agents\/\*\.md or runtime:\*/u,
  );
});

void test("parsePromptPreset rejects duplicate module ids", () => {
  assert.throws(
    () =>
      parsePromptPreset(
        {
          version: 1,
          modules: [
            {
              id: "same",
              enabled: true,
              slot: "pre-history",
              priority: 10,
              header: "first",
              source: "agents/gm-context.md",
            },
            {
              id: "same",
              enabled: true,
              slot: "final-contract",
              priority: 20,
              header: "second",
              source: "agents/gm-output-contract.md",
            },
          ],
        },
        "test-preset.json",
      ),
    /duplicate module id same/u,
  );
});
