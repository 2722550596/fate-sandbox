import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import test from "node:test";

import { lintFinalProse } from "./lint-rules.ts";

/**
 * gm-style-blacklist.md 的「Hard bans」声称 mechanically linted。
 * 本测试逐条验证：md 里列出的每个禁用短语，lintFinalProse 都真的能命中。
 * md 加了新禁令而 lint-rules.ts 没跟上时，这里会红。
 */

const blacklist = readFileSync("agents/gm-style-blacklist.md", "utf-8");
const localLintPath = "agents/user/prose-lint.json";

function hardBanPhrases(): string[] {
  const section = blacklist.split(/## Hard bans[^\n]*\n/u)[1]?.split(/\n## /u)[0] ?? "";
  const phrases: string[] = [];
  for (const line of section.split("\n")) {
    const body = /^- [^:：]+[:：]\s*(.+)$/u.exec(line)?.[1];
    if (body === undefined) continue;
    for (const raw of body.split("/")) {
      const phrase = raw.trim();
      if (phrase.length > 0 && /[\u4e00-\u9fff]/u.test(phrase)) {
        phrases.push(phrase);
      }
    }
  }
  return phrases;
}

/** 把 md 里的禁令短语转成一段应当命中 lint 的样例正文。 */
function sampleFor(phrase: string): string {
  if (phrase.includes("…")) {
    // 并非…而是 等模板：用填充词撑开
    return `他${phrase.replace(/…/gu, "如此这般")}那样。`;
  }
  if (/^像 ?A/u.test(phrase)) {
    return "声音像刀，像火一样割过来。";
  }
  // opening 类禁令放句首，anywhere 类放句中都能覆盖：直接以短语开头
  return `${phrase}，雨还在下。`;
}

void test("every hard-ban phrase in gm-style-blacklist.md is caught by lintFinalProse", () => {
  const phrases = hardBanPhrases();
  assert.ok(phrases.length >= 20, `expected to parse hard-ban phrases, got ${phrases.length}`);

  const missed = phrases.filter((phrase) => lintFinalProse(sampleFor(phrase)).length === 0);
  assert.deepEqual(missed, [], `hard bans not covered by lint-rules.ts: ${missed.join(" / ")}`);
});

void test("markdown headings and dividers inside narration are linted", () => {
  assert.match(blacklist, /Markdown headings and dividers/u);
  assert.ok(lintFinalProse("正文。\n# 标题\n正文。").some((f) => f.ruleId === "markdown-heading"));
  assert.ok(lintFinalProse("正文。\n---\n正文。").some((f) => f.ruleId === "markdown-divider"));
});

void test("players can add local prose lint regex rules", () => {
  withLocalLintFile(
    JSON.stringify({ rules: [{ id: "local-cliche", scope: "anywhere", pattern: "月光如水" }] }),
    () => {
      const findings = lintFinalProse("月光如水，落在窗边。");
      assert.ok(findings.some((finding) => finding.ruleId === "local-cliche"));
    },
  );
});

function withLocalLintFile(content: string, run: () => void): void {
  const original = existsSync(localLintPath) ? readFileSync(localLintPath, "utf-8") : undefined;
  mkdirSync("agents/user", { recursive: true });
  writeFileSync(localLintPath, content, "utf-8");
  try {
    run();
  } finally {
    if (original === undefined) {
      rmSync(localLintPath, { force: true });
    } else {
      writeFileSync(localLintPath, original, "utf-8");
    }
  }
}
