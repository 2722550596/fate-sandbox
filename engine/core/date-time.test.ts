import assert from "node:assert";
// oxlint-disable typescript/no-floating-promises -- node:test 的 it()/describe() 同步重载返回 void，oxlint 类型感知无法区分同步与异步重载。
import { describe, it } from "node:test";

import { advanceIsoTime, diffMinutes, formatHumanTime, isDifferentGameDate } from "./date-time.ts";

describe("date-time", () => {
  it("formats game time with weekday in Asia/Tokyo", () => {
    const formatted = formatHumanTime("2004-01-30T07:00:00.000Z");

    assert.equal(formatted.date, "2004年01月30日");
    assert.equal(formatted.weekday, "星期五");
    assert.equal(formatted.time, "16:00");
    assert.equal(formatted.display, "2004年01月30日 星期五 16:00");
  });

  it("formats game time with weekday in America/Denver", () => {
    const formatted = formatHumanTime("2008-06-03T03:28:00.000Z", "America/Denver");

    assert.equal(formatted.date, "2008年06月02日");
    assert.equal(formatted.weekday, "星期一");
    assert.equal(formatted.time, "21:28");
    assert.equal(formatted.display, "2008年06月02日 星期一 21:28");
  });

  it("advances time using Temporal instants", () => {
    assert.equal(advanceIsoTime("2004-01-30T07:00:00.000Z", 90), "2004-01-30T08:30:00.000Z");
  });

  it("calculates whole minute difference", () => {
    assert.equal(diffMinutes("2004-01-30T07:00:00Z", "2004-01-30T08:30:00Z"), 90);
  });

  it("detects game-date crossing in America/Denver", () => {
    assert.equal(
      isDifferentGameDate("2008-06-03T05:50:00Z", "2008-06-03T06:10:00Z", "America/Denver"),
      true,
    );
  });
});
