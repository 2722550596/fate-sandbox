import assert from "node:assert/strict";
import test from "node:test";
import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { parseTypeBoxValue } from "./typebox-validation.ts";

const UNION_OBJECT_SCHEMA = Type.Object({
  title: Type.String({ minLength: 1 }),
  objectives: Type.Array(Type.String({ minLength: 1 })),
});

const UNION_SAMPLE_SCHEMA = Type.Object({
  nextBeat: Type.Optional(Type.Union([UNION_OBJECT_SCHEMA, Type.Null()])),
});

const UNION_SAMPLE_VALIDATOR = Compile(UNION_SAMPLE_SCHEMA);

const SAMPLE_SCHEMA = Type.Object({
  name: Type.String(),
  count: Type.Integer(),
  enabled: Type.Boolean(),
  note: Type.Union([Type.String(), Type.Null()]),
  tags: Type.Array(Type.String()),
});

const SAMPLE_VALIDATOR = Compile(SAMPLE_SCHEMA);

function validSample(): Record<string, unknown> {
  return { name: "saber", count: 3, enabled: true, note: null, tags: ["servant"] };
}

void test("parseTypeBoxValue keeps LLM-friendly string-to-number coercion", () => {
  const parsed = parseTypeBoxValue(
    { ...validSample(), count: "42", enabled: "true" },
    "sample",
    SAMPLE_VALIDATOR,
  );

  assert.equal(parsed.count, 42);
  assert.equal(parsed.enabled, true);
});

void test("parseTypeBoxValue rejects null laundered into a string", () => {
  assert.throws(
    () => parseTypeBoxValue({ ...validSample(), name: null }, "sample", SAMPLE_VALIDATOR),
    /非法 sample\.name: 类型 null 不会被隐式转换为 string/,
  );
});

void test("parseTypeBoxValue rejects null laundered into a number", () => {
  assert.throws(
    () => parseTypeBoxValue({ ...validSample(), count: null }, "sample", SAMPLE_VALIDATOR),
    /非法 sample\.count: 类型 null 不会被隐式转换为 number/,
  );
});

void test("parseTypeBoxValue rejects number laundered into a string", () => {
  assert.throws(
    () => parseTypeBoxValue({ ...validSample(), name: 42 }, "sample", SAMPLE_VALIDATOR),
    /非法 sample\.name: 类型 number 不会被隐式转换为 string/,
  );
});

void test("parseTypeBoxValue reports coercion path inside arrays", () => {
  assert.throws(
    () => parseTypeBoxValue({ ...validSample(), tags: [123] }, "sample", SAMPLE_VALIDATOR),
    /非法 sample\.tags\[0\]: 类型 number 不会被隐式转换为 string/,
  );
});

void test("parseTypeBoxValue still accepts legitimate null for nullable fields", () => {
  const parsed = parseTypeBoxValue(validSample(), "sample", SAMPLE_VALIDATOR);

  assert.equal(parsed.note, null);
});

void test("parseTypeBoxValue collapses union noise into one branch+actual-type message", () => {
  assert.throws(
    () => parseTypeBoxValue({ nextBeat: "next" }, "args", UNION_SAMPLE_VALIDATOR),
    (error) => {
      const message = String(error);
      // 三条 noise 合并成一条：不再出现 “必须匹配其中一种结构” 这种汇总索查词。
      assert.doesNotMatch(message, /必须匹配其中一种结构/);
      assert.match(message, /args\.nextBeat 必须是 .*object.*实际收到 string/);
      // 同一路径不应重复出现三次。
      assert.equal(message.match(/args\.nextBeat/g)?.length, 1);
      return true;
    },
  );
});

void test("parseTypeBoxValue reports actual type for non-string non-object union mismatches", () => {
  assert.throws(
    () => parseTypeBoxValue({ nextBeat: 42 }, "args", UNION_SAMPLE_VALIDATOR),
    /args\.nextBeat .*实际收到 number/,
  );
  assert.throws(
    () => parseTypeBoxValue({ nextBeat: ["a"] }, "args", UNION_SAMPLE_VALIDATOR),
    /args\.nextBeat .*实际收到 array/,
  );
});

void test("parseTypeBoxValue describes object-shape branch with missing required fields", () => {
  assert.throws(
    () => parseTypeBoxValue({ nextBeat: { foo: "bar" } }, "args", UNION_SAMPLE_VALIDATOR),
    (error) => {
      const message = String(error);
      assert.match(message, /args\.nextBeat 必须是/);
      assert.match(message, /包含 title, objectives 的对象/);
      assert.match(message, /实际收到 object/);
      assert.doesNotMatch(message, /必须匹配其中一种结构/);
      return true;
    },
  );
});
