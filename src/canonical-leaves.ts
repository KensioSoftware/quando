/**
 * Writing the fields of a leaf rule the one way.
 *
 * Days, months and dates come off a form in whatever order they were thought
 * of, and a merge of two sources says some of them twice. Each list here is
 * ordered the way a calendar reads and reduced to one of each.
 *
 * Nothing here throws. A date that will not parse comes back untouched, for
 * the reason given in [canonical-rule.ts](./canonical-rule.ts).
 */

import {
  type MonthCode,
  MONTHS,
  type Month,
  WEEKDAYS,
  type Weekday,
} from "./rule.js";

/** Where a weekday sorts. Calendar order rather than alphabetical. */
const DAY_ORDER = new Map(WEEKDAYS.map((day, index) => [day, index]));

/** Where a month sorts. Calendar order, for the same reason. */
const MONTH_ORDER = new Map(MONTHS.map((month, index) => [month, index]));

const asTime = (from: string): Temporal.PlainTime =>
  Temporal.PlainTime.from(from);

const asDate = (from: string): Temporal.PlainDate =>
  Temporal.PlainDate.from(from);

const asDuration = (from: string): Temporal.Duration =>
  Temporal.Duration.from(from);

/**
 * A `Temporal` value written the one way, where it can be read at all.
 *
 * `"09:00"` and `"09:00:00"` are the same time of day written twice, and two
 * rules holding one each should compare equal. A string neither form can read
 * is handed back as it came, so this stays total.
 */
function written(
  value: string,
  read: (from: string) => { toString: () => string },
): string {
  try {
    return read(value).toString();
  } catch {
    return value;
  }
}

export const canonicalTime = (value: string): string => written(value, asTime);

export const canonicalDate = (value: string): string => written(value, asDate);

/**
 * A duration written the one way, so `"pt4h"` and `"PT4H"` compare equal.
 *
 * Formatting only. `PT60M` and `PT1H` stay apart, because balancing one into
 * the other means knowing how long a day is and a duration holding months
 * cannot be balanced at all. Two rules covering the same time by different
 * routes staying different is the position canonical form takes everywhere.
 */
export const canonicalDuration = (value: string): string =>
  written(value, asDuration);

export function canonicalDays(days: readonly Weekday[]): Weekday[] {
  return [...new Set(days)].toSorted(
    (a, b) => (DAY_ORDER.get(a) ?? 0) - (DAY_ORDER.get(b) ?? 0),
  );
}

/** Days from the start of the month first, then days from the end. */
export function canonicalMonthDays(days: readonly number[]): number[] {
  const unique = [...new Set(days)];
  return [
    ...unique.filter((day) => day > 0).toSorted((a, b) => a - b),
    ...unique.filter((day) => day < 0).toSorted((a, b) => a - b),
  ];
}

/**
 * Month codes ordered and reduced to one of each.
 *
 * String order is calendar order here. The digits are padded to two, and a leap
 * month sorts straight after the month it follows, giving `"M05"`, `"M05L"`,
 * `"M06"`. Code-unit order rather than `localeCompare`. The form a rule is
 * stored in should not depend on where it was stored.
 */
export function canonicalMonthCodes(codes: readonly MonthCode[]): MonthCode[] {
  return [...new Set(codes)].toSorted();
}

export function canonicalMonths(months: readonly Month[]): Month[] {
  return [...new Set(months)].toSorted(
    (a, b) => (MONTH_ORDER.get(a) ?? 0) - (MONTH_ORDER.get(b) ?? 0),
  );
}

export function canonicalDates(dates: readonly string[]): string[] {
  const one = dates.map((date) => written(date, asDate));
  return [...new Set(one)].toSorted();
}
