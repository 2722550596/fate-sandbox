import assert from "node:assert/strict";
import test from "node:test";

import { buildChoiceWidgetLines, parseChoiceCommand } from "./index.ts";

void test("parseChoiceCommand parses submit and show commands", () => {
  assert.deepEqual(parseChoiceCommand(""), { kind: "show" });
  assert.deepEqual(parseChoiceCommand("2"), { kind: "submit", index: 1 });
  assert.equal(parseChoiceCommand("abc"), undefined);
});

void test("buildChoiceWidgetLines renders numbered full command text", () => {
  assert.deepEqual(
    buildChoiceWidgetLines([{ submitText: "我追上去。" }, { submitText: "我检查现场。" }]),
    ["── 可选行动（可忽略，直接手打也可以）──", "/choice 1  我追上去。", "/choice 2  我检查现场。"],
  );
});
