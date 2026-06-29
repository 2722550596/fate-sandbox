import assert from "node:assert/strict";
import test from "node:test";

import { parseAmountString, formatAmount } from "./economy-denomination.ts";

// ─── parseAmountString: loen ───────────────────────────────────

void test("parseAmountString loen: 1金镑5苏勒 → 300", () => {
  assert.equal(parseAmountString("1金镑5苏勒", "loen"), 1 * 240 + 5 * 12);
});

void test("parseAmountString loen: 5便士 → 5", () => {
  assert.equal(parseAmountString("5便士", "loen"), 5);
});

void test("parseAmountString loen: 1金镑 → 240", () => {
  assert.equal(parseAmountString("1金镑", "loen"), 240);
});

void test("parseAmountString loen: 3苏勒2便士 → 38", () => {
  assert.equal(parseAmountString("3苏勒2便士", "loen"), 3 * 12 + 2);
});

void test("parseAmountString loen: 0金镑 抛出错误", () => {
  assert.throws(() => parseAmountString("0金镑", "loen"), /无法解析/);
});

void test("parseAmountString loen: 空字符串 抛出错误", () => {
  assert.throws(() => parseAmountString("", "loen"), /无效的金额字符串/);
});

void test("parseAmountString loen: 3s12d 不支持的格式 抛出错误", () => {
  assert.throws(() => parseAmountString("3s12d", "loen"), /无法解析/);
});

void test("parseAmountString loen: 带空格 1金镑 5苏勒 → 300", () => {
  assert.equal(parseAmountString("1金镑 5苏勒", "loen"), 300);
});

// ─── parseAmountString: fesac ──────────────────────────────────

void test("parseAmountString fesac: 1金霍恩5弗银 → 150", () => {
  assert.equal(parseAmountString("1金霍恩5弗银", "fesac"), 1 * 100 + 5 * 10);
});

void test("parseAmountString fesac: 10戈比 → 10", () => {
  assert.equal(parseAmountString("10戈比", "fesac"), 10);
});

void test("parseAmountString fesac: 金镑不属于fesac 抛出错误", () => {
  // 金镑不在 fesac 中文单位列表内，正则无匹配 → 无法解析
  assert.throws(() => parseAmountString("1金镑", "fesac"), /无法解析/);
});

// ─── parseAmountString: intis ──────────────────────────────────

void test("parseAmountString intis: 1费尔金 → 100", () => {
  assert.equal(parseAmountString("1费尔金", "intis"), 100);
});

void test("parseAmountString intis: 1费尔金5里克 → 105", () => {
  assert.equal(parseAmountString("1费尔金5里克", "intis"), 1 * 100 + 5 * 5);
});

// ─── parseAmountString: feynapotter ────────────────────────────

void test("parseAmountString feynapotter: 1金里索2塞塔 → 120", () => {
  assert.equal(parseAmountString("1金里索2塞塔", "feynapotter"), 1 * 100 + 2 * 10);
});

// ─── formatAmount ──────────────────────────────────────────────

void test("formatAmount loen: 300 → 1金镑5苏勒", () => {
  assert.equal(formatAmount(300, "loen"), "1金镑5苏勒");
});

void test("formatAmount loen: 5 → 5便士", () => {
  assert.equal(formatAmount(5, "loen"), "5便士");
});

void test("formatAmount loen: 0 → 0便士", () => {
  assert.equal(formatAmount(0, "loen"), "0便士");
});

void test("formatAmount fesac: 150 → 1金霍恩5弗银", () => {
  assert.equal(formatAmount(150, "fesac"), "1金霍恩5弗银");
});

void test("formatAmount intis: 105 → 1费尔金1里克", () => {
  // 105 = 1*100 + 1*5, 里克 toSmallest=5, 余0科佩
  assert.equal(formatAmount(105, "intis"), "1费尔金1里克");
});
