import assert from "node:assert/strict";
import test from "node:test";

import { buildDirectorSpawnArgs } from "./backstage-spawn.ts";
import { BACKSTAGE_MODEL, BACKSTAGE_SESSION_DIR } from "./backstage-substrate-config.ts";

void test("buildDirectorSpawnArgs composes the hermetic pi -p argv", () => {
  const args = buildDirectorSpawnArgs("DIRECTOR PROMPT BODY", "bl-caster-ryudou");

  // headless / hermetic flags
  assert.ok(args.includes("-p"));
  assert.ok(args.includes("--no-tools"));
  assert.ok(args.includes("--no-approve"));
  assert.ok(args.includes("--no-context-files"));
  // pinned model + durable session, not inherited
  assert.deepEqual(args.slice(args.indexOf("--model"), args.indexOf("--model") + 2), [
    "--model",
    BACKSTAGE_MODEL,
  ]);
  assert.deepEqual(args.slice(args.indexOf("--session-dir"), args.indexOf("--session-dir") + 2), [
    "--session-dir",
    BACKSTAGE_SESSION_DIR,
  ]);
  assert.deepEqual(args.slice(args.indexOf("--session-id"), args.indexOf("--session-id") + 2), [
    "--session-id",
    "bl-caster-ryudou",
  ]);
  // the prompt is the final positional arg (no shell, so no quoting concerns)
  assert.equal(args.at(-1), "DIRECTOR PROMPT BODY");
});
