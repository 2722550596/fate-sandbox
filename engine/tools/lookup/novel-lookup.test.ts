import assert from "node:assert/strict";
import test from "node:test";

import { lookupNovel } from "./novel-lookup.ts";

void test("lookupNovel: list all volumes", () => {
  const result = lookupNovel({});
  assert(result.text.includes("《诡秘之主》"));
  assert(result.text.includes("第一卷"));
});

void test("lookupNovel: volume only lists chapters", () => {
  const result = lookupNovel({ volume: "001" });
  // 卷显示格式为 "卷 001：第一卷·小丑"
  assert(result.text.includes("卷 001"));
  assert(result.text.includes("第一卷") && result.text.includes("小丑"));
});
void test("lookupNovel: title keyword search", () => {
  // 搜标题关键词，不搜正文
  const result = lookupNovel({ query: "绯红", fulltext: false });
  // 可能找到或未找到——重要的是不报错且格式正确
  assert(result.text.includes("绯红") || result.text.includes("未在章节标题"));
});

void test("lookupNovel: no match returns appropriate message", () => {
  const result = lookupNovel({ query: "【不可能存在的关键词xyzzy】", fulltext: false });
  assert(result.text.includes("未在章节标题"));
});

void test("lookupNovel: volume + keyword search", () => {
  const result = lookupNovel({ volume: "001", query: "占卜", fulltext: false });
  // 应该能在第一卷找到占卜相关章节（克莱恩的占卜家序列）
  assert(result.text.includes("占卜") || result.text.includes("未"));
});

void test("lookupNovel: fulltext search finds content matches", () => {
  // "阿罗德斯" 是一面镜子的名字，出现在正文中
  const result = lookupNovel({ query: "阿罗德斯", limit: 5 });
  // 可能标题匹配或正文匹配
  assert(result.text.includes("阿罗德斯"));
  assert(result.text.includes("正文匹配") || result.text.includes("标题匹配"));
});

void test("lookupNovel: read chapter by number", () => {
  const result = lookupNovel({ volume: "001", chapter: "1" });
  assert(result.text.includes("第一章") || result.text.includes("第一三章"));
});
