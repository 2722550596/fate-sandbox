import assert from "node:assert/strict";
import test from "node:test";

import { summarizeToolText } from "./tool-render.ts";

void test("summarizeToolText 取第一条非空行作首行", () => {
  const { firstLine } = summarizeToolText("## 当前状态\n时间：白天\n地点：学园都市");
  assert.equal(firstLine, "## 当前状态");
});

void test("summarizeToolText 跳过开头空行，trim 首行两端空白", () => {
  const { firstLine } = summarizeToolText("\n\n   绫香受了伤   \n下一行");
  assert.equal(firstLine, "绫香受了伤");
});

void test("summarizeToolText 行数忽略尾部空行", () => {
  const { lineCount } = summarizeToolText("a\nb\nc\n\n\n");
  assert.equal(lineCount, 3);
});

void test("summarizeToolText 单行输入 lineCount=1", () => {
  const result = summarizeToolText("伤势已记录。");
  assert.equal(result.firstLine, "伤势已记录。");
  assert.equal(result.lineCount, 1);
});

void test("summarizeToolText 空字符串安全降级", () => {
  const result = summarizeToolText("");
  assert.equal(result.firstLine, "");
  assert.equal(result.lineCount, 0);
});

void test("summarizeToolText 纯空白输入 firstLine 为空、lineCount 为 0", () => {
  const result = summarizeToolText("   \n  \n");
  assert.equal(result.firstLine, "");
  assert.equal(result.lineCount, 0);
});
