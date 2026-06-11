import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadProseDigests, saveProseDigest } from "./prose-digest-store.ts";

function tempStorePath(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "prose-digest-"));
  return { path: join(dir, "digests.json"), cleanup: () => rmSync(dir, { recursive: true }) };
}

void test("prose digest store round-trips entries", () => {
  const { path, cleanup } = tempStorePath();
  try {
    assert.equal(loadProseDigests(path).size, 0);
    saveProseDigest("tc-1", "  第一轮摘要\n带换行  ", path);
    saveProseDigest("tc-2", "第二轮摘要", path);
    const digests = loadProseDigests(path);
    assert.equal(digests.get("tc-1"), "第一轮摘要 带换行");
    assert.equal(digests.get("tc-2"), "第二轮摘要");
  } finally {
    cleanup();
  }
});

void test("prose digest store ignores empty writes and corrupt files", () => {
  const { path, cleanup } = tempStorePath();
  try {
    saveProseDigest("", "摘要", path);
    saveProseDigest("tc-1", "   ", path);
    assert.equal(loadProseDigests(path).size, 0);
    writeFileSync(path, "{not json", "utf-8");
    assert.equal(loadProseDigests(path).size, 0);
    saveProseDigest("tc-1", "重建后的摘要", path);
    assert.equal(loadProseDigests(path).get("tc-1"), "重建后的摘要");
  } finally {
    cleanup();
  }
});

void test("prose digest store evicts oldest entries beyond the cap", () => {
  const { path, cleanup } = tempStorePath();
  try {
    for (let index = 1; index <= 502; index++) {
      saveProseDigest(`tc-${index}`, `摘要 ${index}`, path);
    }
    const digests = loadProseDigests(path);
    assert.equal(digests.size, 500);
    assert.equal(digests.get("tc-1"), undefined);
    assert.equal(digests.get("tc-2"), undefined);
    assert.equal(digests.get("tc-502"), "摘要 502");
  } finally {
    cleanup();
  }
});
