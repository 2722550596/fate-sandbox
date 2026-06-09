import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseTurnTimePolicySchema } from "./turn-time-schema";

void describe("parseTurnTimePolicySchema", () => {
  void test("reports invalid kind as enum choices instead of anyOf noise", () => {
    assert.throws(
      () => parseTurnTimePolicySchema({ kind: "none", elapsedMinutes: 1, reason: "推进" }, "time"),
      /time\.kind 必须是允许值之一: elapsed, travel/,
    );
  });

  void test("validates only the selected turn time variant", () => {
    assert.throws(
      () => parseTurnTimePolicySchema({ kind: "elapsed", reason: "推进" }, "time"),
      (error) => {
        const message = String(error);
        assert.match(message, /缺少必填字段: elapsedMinutes/);
        assert.doesNotMatch(message, /location/);
        assert.doesNotMatch(message, /anyOf/);
        return true;
      },
    );
  });

  void test("keeps numeric string conversion for elapsed minutes", () => {
    const time = parseTurnTimePolicySchema(
      { kind: "elapsed", elapsedMinutes: "3", reason: "推进" },
      "time",
    );

    assert.deepEqual(time, { kind: "elapsed", elapsedMinutes: 3, reason: "推进" });
  });
});
