/**
 * Checking one field of an incoming rule document.
 *
 * These are the checks that know about time: a day of the week is one of
 * seven names, a date is a date, a zone is one the runtime has heard of. Each
 * either returns the value at the type it claims to be, or throws saying what
 * was found instead and where.
 *
 * [parse-shape.ts](./parse-shape.ts) holds the ones underneath, which check
 * that JSON is the shape it claims to be and know nothing about time.
 */

import { asString, asStrings, fail } from "./parse-shape.js";
import {
  MONTHS,
  type Month,
  PERIODS,
  type Period,
  WEEKDAYS,
  type Weekday,
} from "./rule.js";

const WEEKDAY_NAMES = new Set<string>(WEEKDAYS);
const MONTH_NAMES = new Set<string>(MONTHS);

export function asDays(value: unknown, path: string): Weekday[] {
  return asStrings(value, path).map((day, index) =>
    WEEKDAY_NAMES.has(day)
      ? (day as Weekday)
      : fail(
          `${path}[${index}]`,
          `"${day}" is not a day of the week. Expected one of ${WEEKDAYS.join(", ")}`,
        ),
  );
}

export function asMonths(value: unknown, path: string): Month[] {
  return asStrings(value, path).map((month, index) =>
    MONTH_NAMES.has(month)
      ? (month as Month)
      : fail(
          `${path}[${index}]`,
          `"${month}" is not a month. Expected one of ${MONTHS.join(", ")}`,
        ),
  );
}

export function asPeriod(value: unknown, path: string): Period {
  const period = asString(value, path);
  return PERIODS.includes(period as Period)
    ? (period as Period)
    : fail(
        path,
        `"${period}" is not a period. Expected one of ${PERIODS.join(", ")}`,
      );
}

/** Checked by construction, so a malformed time is caught where it is written. */
export function asTime(value: unknown, path: string): string {
  const time = asString(value, path);
  try {
    Temporal.PlainTime.from(time);
  } catch {
    return fail(
      path,
      `"${time}" is not a time of day. Expected something like "09:00"`,
    );
  }
  return time;
}

export function asDates(value: unknown, path: string): string[] {
  return asStrings(value, path).map((date, index) =>
    asDate(date, `${path}[${index}]`),
  );
}

export function asDate(value: unknown, path: string): string {
  const date = asString(value, path);
  try {
    Temporal.PlainDate.from(date);
  } catch {
    return fail(
      path,
      `"${date}" is not a date. Expected something like "2026-03-14"`,
    );
  }
  return date;
}

/**
 * A zone is checked here rather than left to fail at query time, because a
 * mistyped one in a stored rule should be a problem when the rule is read, not
 * hours later when something asks a question of it.
 */
export function asZone(value: unknown, path: string): string {
  const zone = asString(value, path);
  try {
    Temporal.PlainDate.from("2000-01-01").toZonedDateTime({
      timeZone: zone,
      plainTime: "00:00",
    });
  } catch {
    return fail(path, `"${zone}" is not a known time zone`);
  }
  return zone;
}

/** Present or absent, never present-and-undefined. */
export function zonePart(
  node: Record<string, unknown>,
  path: string,
): { zone?: string } {
  const zone = node["zone"];
  return zone === undefined ? {} : { zone: asZone(zone, `${path}.zone`) };
}
