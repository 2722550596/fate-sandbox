import assert from "node:assert/strict";
import test from "node:test";

import { lookupEconomyPrice } from "./economy-lookup.ts";

void test("lookupEconomyPrice: find potion-formula by id", () => {
  const result = lookupEconomyPrice({ category: "potion-formula" });
  assert(result.text.includes("魔药配方公允价"));
  assert(result.text.includes("序列9"));
});

void test("lookupEconomyPrice: find food-staple by id", () => {
  const result = lookupEconomyPrice({ category: "food-staple" });
  assert(result.text.includes("主食"));
  assert(result.text.includes("黑麦面包"));
});

void test("lookupEconomyPrice: free query matches daily category", () => {
  const result = lookupEconomyPrice({ query: "租房" });
  assert(result.text.includes("租房市场"));
  assert(result.text.includes("两居室公寓"));
});

void test("lookupEconomyPrice: list all includes both tables", () => {
  const result = lookupEconomyPrice({});
  // 非凡物品类别
  assert(result.text.includes("potion-formula"));
  assert(result.text.includes("characteristic"));
  // 日用品类别
  assert(result.text.includes("food-staple"));
  assert(result.text.includes("housing-rent"));
  assert(result.text.includes("salary-reference"));
  assert(result.text.includes("transport"));
});

void test("lookupEconomyPrice: sequence mode skips daily categories", () => {
  const result = lookupEconomyPrice({ sequence: 7 });
  assert(result.text.includes("序列7"));
  assert(!result.text.includes("主食")); // daily category should not appear
  assert(!result.text.includes("黑麦面包"));
});

void test("lookupEconomyPrice: clothing category from book data", () => {
  const result = lookupEconomyPrice({ category: "clothing" });
  assert(result.text.includes("绅士全套"));
  assert(result.text.includes("丝绸礼帽"));
  assert(result.text.includes("梅丽莎新裙子"));
});

void test("lookupEconomyPrice: weapons category", () => {
  const result = lookupEconomyPrice({ category: "weapons" });
  assert(result.text.includes("制式左轮手枪"));
  assert(result.text.includes("双筒猎枪"));
});

void test("lookupEconomyPrice: income tax bracket", () => {
  const result = lookupEconomyPrice({ query: "所得税" });
  assert(result.text.includes("E类雇员税"));
  assert(result.text.includes("周薪2-5镑"));
});

void test("lookupEconomyPrice: beyonder-service with high-value rewards", () => {
  const result = lookupEconomyPrice({ category: "beyonder-service" });
  assert(result.text.includes("寻找齐林格斯赏金"));
  assert(result.text.includes("450 镑"));
});
void test("lookupEconomyPrice: salary-reference expanded with Nighthawks", () => {
  const result = lookupEconomyPrice({ query: "收入" });
  assert(result.text.includes("周薪参考"));
  assert(result.text.includes("老尼尔"));
  assert(result.text.includes("值夜者资深"));
});

void test("lookupEconomyPrice: housing-purchase query", () => {
  const result = lookupEconomyPrice({ query: "购房" });
  assert(result.text.includes("房屋购买"));
  assert(result.text.includes("15年期地契"));
});

void test("lookupEconomyPrice: list all now includes all new categories", () => {
  const result = lookupEconomyPrice({});
  assert(result.text.includes("clothing"));
  assert(result.text.includes("weapons"));
  assert(result.text.includes("income-tax"));
  assert(result.text.includes("beyonder-service"));
  assert(result.text.includes("entertainment"));
  assert(result.text.includes("housing-purchase"));
});

void test("lookupEconomyPrice: find salary-reference by id", () => {
  const result = lookupEconomyPrice({ category: "salary-reference" });
  assert(result.text.includes("周薪参考"));
  assert(result.text.includes("廷根大学讲师"));
});

void test("lookupEconomyPrice: transport category shows all modes", () => {
  const result = lookupEconomyPrice({ category: "transport" });
  assert(result.text.includes("公共马车"));
  assert(result.text.includes("出租马车"));
  assert(result.text.includes("蒸汽列车"));
});
