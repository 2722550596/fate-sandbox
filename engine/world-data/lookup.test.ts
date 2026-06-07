import assert from "node:assert/strict";
import test from "node:test";

import { lookupWorldData } from "./lookup";

void test("lookupWorldData searches across all data without category", () => {
  const result = lookupWorldData({ query: "冬木 教会" });

  assert.match(result.text, /冬木教会/);
  assert.doesNotMatch(result.text, /未找到/);
});

void test("lookupWorldData accepts legacy category but does not require it", () => {
  const result = lookupWorldData({ query: "远坂凛", category: "角色" });

  assert.match(result.text, /远坂凛/);
});

void test("lookupWorldData finds FSF Ayaka aliases", () => {
  const result = lookupWorldData({ query: "绫香 沙条 Fate strange Fake" });

  assert.match(result.text, /绫香·沙条/);
  assert.match(result.text, /沙条绫香/);
  assert.match(result.text, /不是谜语人/);
});

void test("lookupWorldData finds FSF genre contract", () => {
  const result = lookupWorldData({ query: "FSF 斯诺菲尔德 悬疑 战场情报缺口" });

  assert.match(result.text, /Fate\/strange Fake世界线契约/);
  assert.match(result.text, /战场情报缺口/);
  assert.match(result.text, /不可行动的气氛钩子/);
});

void test("lookupWorldData finds Fate EXTRA timeline contract", () => {
  const result = lookupWorldData({ query: "Fate EXTRA Moon Cell SE.RA.PH 月之圣杯战争" });

  assert.match(result.text, /\[时间线\] Fate\/EXTRA/);
  assert.match(result.text, /<timeline id="extra">/);
  assert.match(result.text, /128 名正式 Master/);
  assert.match(result.text, /不得混用 Fate\/EXTRA CCC/);
});

void test("lookupWorldData finds Snowfield locations", () => {
  const result = lookupWorldData({ query: "斯诺菲尔德 歌剧院 临时藏身处" });

  assert.match(result.text, /斯诺菲尔德/);
  assert.match(result.text, /歌剧院/);
  assert.match(result.text, /临时藏身处/);
});

void test("lookupWorldData finds Kara no Kyoukai Shiki as a character", () => {
  const result = lookupWorldData({ query: "两仪式 空之境界" });

  assert.match(result.text, /\[角色\] 两仪式/);
  assert.match(result.text, /直死之魔眼/);
});
