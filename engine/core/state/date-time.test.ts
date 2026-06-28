import assert from "node:assert";
// oxlint-disable typescript/no-floating-promises -- node:test 的 it()/describe() 同步重载返回 void，oxlint 类型感知无法区分同步与异步重载。
import { describe, it, test } from "node:test";

import { advanceIsoTime, diffMinutes, formatHumanTime, isDifferentGameDate, normalizeIsoInstant } from "./date-time.ts";

describe("date-time", () => {
  it("formats LOTM epoch start time (1349-01-01 Monday 07:00)", () => {
    const formatted = formatHumanTime("1349-01-01T07:00:00.000Z");

    assert.equal(formatted.date, "1349年01月01日");
    assert.equal(formatted.weekday, "星期一");
    assert.equal(formatted.time, "07:00");
    assert.equal(formatted.display, "第五纪1349年01月01日 星期一 07:00");
  });

  it("formats LOTM time one day later", () => {
    const formatted = formatHumanTime("1349-01-02T07:00:00.000Z");

    assert.equal(formatted.date, "1349年01月02日");
    assert.equal(formatted.weekday, "星期二");
    assert.equal(formatted.display, "第五纪1349年01月02日 星期二 07:00");
  });

  it("advances time using Temporal instants", () => {
    assert.equal(advanceIsoTime("1349-01-01T07:00:00.000Z", 90), "1349-01-01T08:30:00.000Z");
  });

  it("calculates whole minute difference", () => {
    assert.equal(diffMinutes("1349-01-01T07:00:00Z", "1349-01-01T08:30:00Z"), 90);
  });

  it("detects game-date crossing in UTC", () => {
    assert.equal(isDifferentGameDate("1349-01-01T23:00:00Z", "1349-01-02T01:00:00Z"), true);
  });
});

void test("normalizeIsoInstant preserves valid ISO instants", () => {
  assert.equal(
    normalizeIsoInstant("2004-01-30T08:00:00Z", "test"),
    "2004-01-30T08:00:00.000Z",
  );
});

void test("normalizeIsoInstant accepts ISO with timezone offset", () => {
  assert.equal(
    normalizeIsoInstant("2004-01-30T16:00:00+08:00", "test"),
    "2004-01-30T08:00:00.000Z",
  );
});

void test("normalizeIsoInstant throws on invalid input", () => {
  assert.throws(
    () => normalizeIsoInstant("not-a-date", "timeField"),
    /非法timeField/,
  );
});
