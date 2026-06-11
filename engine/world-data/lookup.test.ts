import assert from "node:assert/strict";
import test from "node:test";

import { lookupWorldData } from "./lookup.ts";

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

void test("lookupWorldData finds Fate EXTRA character indexes", () => {
  const hakuno = lookupWorldData({ query: "Fate EXTRA 岸波白野 主人公 记忆缺损" });
  assert.match(hakuno.text, /\[角色\] 岸波白野/);
  assert.match(hakuno.text, /不要默认玩家就是岸波白野/);

  const rin = lookupWorldData({ query: "远坂凛 EXTRA 霊子黑客 不是 Fate stay night" });
  assert.match(rin.text, /\[角色\] 远坂凛（EXTRA）/);
  assert.match(rin.text, /不是 Fate\/stay night 的远坂凛/);
});

void test("lookupWorldData finds Fate EXTRA servant indexes", () => {
  const nero = lookupWorldData({ query: "尼禄 克劳狄乌斯 赤Saber EXTRA" });
  assert.match(nero.text, /名称：尼禄·克劳狄乌斯/);
  assert.match(nero.text, /外部检索确认/);
  assert.doesNotMatch(nero.text, /"id": "nero-claudius-saber-extra"/);

  const saver = lookupWorldData({ query: "Saver 觉者 特维斯 EXTRA" });
  assert.match(saver.text, /名称：觉者/);
  assert.match(saver.text, /Saver 不是常规七职阶/);
  assert.doesNotMatch(saver.text, /"id": "saver-buddha-extra"/);
});

void test("lookupWorldData finds Fate EXTRA CCC timeline contract", () => {
  const result = lookupWorldData({ query: "Fate EXTRA CCC 月之裏側 Sakura Labyrinth BB" });

  assert.match(result.text, /\[时间线\] Fate\/EXTRA CCC/);
  assert.match(result.text, /<timeline id="extra-ccc">/);
  assert.match(result.text, /旧校舍是月之裏側少数安全据点/);
  assert.match(result.text, /不得混用 Fate\/EXTRA CCC FoxTail/);
});

void test("lookupWorldData finds Fate EXTRA CCC character indexes", () => {
  const bb = lookupWorldData({ query: "BB核心 黑衣少女 MoonCancer CCC" });
  assert.match(bb.text, /\[角色\] BB（CCC）/);
  assert.match(bb.text, /不要把 FGO 的 MoonCancer 职阶/);

  const jinako = lookupWorldData({ query: "吉娜可 迦尔纳 CCC 网络中毒 Master" });
  assert.match(jinako.text, /\[角色\] 吉娜可＝加里吉利/);
  assert.match(jinako.text, /迦尔纳阵营/);
});

void test("lookupWorldData finds Fate EXTRA CCC servant indexes", () => {
  const karna = lookupWorldData({ query: "迦尔纳 CCC 吉娜可 职阶不明" });
  assert.match(karna.text, /名称：迦尔纳（CCC）/);
  assert.match(karna.text, /职阶不明/);
  assert.doesNotMatch(karna.text, /"id": "karna-servant-ccc"/);

  const alterEgo = lookupWorldData({ query: "Passionlip Meltryllis Alter Ego CCC BB眷属" });
  assert.match(alterEgo.text, /名称：帕ッションリップ/);
  assert.match(alterEgo.text, /名称：梅尔特莉莉丝/);
  assert.doesNotMatch(alterEgo.text, /"id": "passionlip-alter-ego-ccc"/);
  assert.doesNotMatch(alterEgo.text, /"id": "meltryllis-alter-ego-ccc"/);
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
