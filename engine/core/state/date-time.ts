import type { TimeZoneId } from "./state.ts";

import { Temporal } from "@js-temporal/polyfill";

export const DEFAULT_TIME_ZONE: TimeZoneId = "UTC";

/**
 * LOTM 第五纪起始时刻的 ISO 锚点。
 * 第五纪1349年1月1日 星期一 07:00 对应这个 UTC instant。
 * 内部时间始终以 ISO 存储；显示时转换为第五纪历法。
 */
const EPOCH_ISO = "1349-01-01T07:00:00.000Z";
const EPOCH_INSTANT = Temporal.Instant.from(EPOCH_ISO);

export interface HumanTimeParts {
  iso: string;
  date: string;
  time: string;
  weekday: string;
  display: string;
}

const WEEKDAY_NAMES = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

export function nowIso(): string {
  return Temporal.Now.instant().toString({ smallestUnit: "millisecond" });
}

export function normalizeIsoInstant(value: string, fieldName: string): string {
  try {
    return Temporal.Instant.from(value).toString({ smallestUnit: "millisecond" });
  } catch (error) {
    throw new Error(`非法${fieldName}: ${value}。${fieldName}必须是 ISO 时间字符串。`, {
      cause: error,
    });
  }
}

export function advanceIsoTime(isoTime: string, minutes: number): string {
  return parseInstant(isoTime, "推进时间")
    .add({ minutes })
    .toString({ smallestUnit: "millisecond" });
}

export function diffMinutes(fromIso: string, toIso: string): number {
  const from = parseInstant(fromIso, "起始时间");
  const to = parseInstant(toIso, "结束时间");
  const duration = from.until(to, { largestUnit: "minutes", smallestUnit: "minutes" });
  return duration.minutes;
}

export function isDifferentGameDate(
  beforeIso: string,
  afterIso: string,
  _timezone: TimeZoneId = DEFAULT_TIME_ZONE,
): boolean {
  const beforeDate = toEpochDayOffset(beforeIso);
  const afterDate = toEpochDayOffset(afterIso);
  return beforeDate !== afterDate;
}

/**
 * 将 ISO 时间格式化为 LOTM 第五纪历法显示。
 * 格式：第五纪XXXX年XX月XX日 星期X HH:MM
 */
export function formatHumanTime(
  isoTime: string,
  _timezone: TimeZoneId = DEFAULT_TIME_ZONE,
): HumanTimeParts {
  const instant = parseInstant(isoTime, "显示时间");
  const zoned = instant.toZonedDateTimeISO("UTC");

  // 计算与第五纪纪元起点的天数差
  const epochZoned = EPOCH_INSTANT.toZonedDateTimeISO("UTC");
  const epochDate = epochZoned.toPlainDate();
  const currentDate = zoned.toPlainDate();
  const dayDiff = epochDate.until(currentDate, { largestUnit: "days" }).days;

  // 第五纪1349年1月1日是星期一（dayDiff=0 → weekday index 0）
  const weekdayIndex = ((dayDiff % 7) + 7) % 7;
  const weekday = WEEKDAY_NAMES[weekdayIndex] ?? "星期一";

  const year = 1349 + Math.floor(dayDiff / 365);
  // 简化：直接用日历月日（LOTM 世界假设与地球日历一致）
  const month = zoned.month;
  const day = zoned.day;
  const date = `${year}年${pad2(month)}月${pad2(day)}日`;
  const time = `${pad2(zoned.hour)}:${pad2(zoned.minute)}`;

  return {
    iso: instant.toString({ smallestUnit: "millisecond" }),
    date,
    time,
    weekday,
    display: `第五纪${date} ${weekday} ${time}`,
  };
}

function parseInstant(isoTime: string, fieldName: string): Temporal.Instant {
  try {
    return Temporal.Instant.from(isoTime);
  } catch (error) {
    throw new Error(`无法解析${fieldName}: ${isoTime}`, { cause: error });
  }
}

function toEpochDayOffset(isoTime: string): number {
  const instant = parseInstant(isoTime, "游戏日期");
  const zoned = instant.toZonedDateTimeISO("UTC");
  const epochZoned = EPOCH_INSTANT.toZonedDateTimeISO("UTC");
  return epochZoned.toPlainDate().until(zoned.toPlainDate(), { largestUnit: "days" }).days;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** LOTM 第五纪起始时刻的 ISO 字符串，供 state-store 使用。 */

/**
 * 将人性化时间输入解析为绝对 ISO 字符串。
 * 接受 ISO 字符串（直通）或相对偏移（+30min / +2hours / +1day / -4hours）。
 * 拒绝纯自然语言时间；LLM 必须给出明确的单位和方向。
 */
export function resolveRelativeTime(input: string, currentIso: string): string {
  // 先试 ISO 直通
  try {
    return normalizeIsoInstant(input, "relative time");
  } catch {
    // not ISO, try relative
  }
  const trimmed = input.trim();
  const match = /^([+-])(\d+)(min|mins|hour|hours|day|days)$/.exec(trimmed);
  if (match === null) {
    throw new Error(
      `无法解析时间: ${trimmed}。接受 ISO 字符串或相对偏移（+30min / +2hours / +1day / -4hours）。`
    );
  }
  const value = Number(match[2]) * (match[1] === "+" ? 1 : -1);
  const unit = match[3];
  const instant = Temporal.Instant.from(currentIso);
  let result: Temporal.Instant;
  switch (unit) {
    case "min":
    case "mins":
      result = instant.add({ minutes: value });
      break;
    case "hour":
    case "hours":
      result = instant.add({ hours: value });
      break;
    case "day":
    case "days":
      result = instant.add({ hours: value * 24 });
      break;
    default:
      throw new Error(`不支持的时间单位: ${unit}。支持: min/mins/hour/hours/day/days。`);
  }
  return result.toString({ smallestUnit: "millisecond" });
}
export const LOTM_EPOCH_ISO = EPOCH_ISO;
