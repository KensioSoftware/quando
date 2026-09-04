/**
 * Rules that select whole days by where they sit in the month or the year.
 *
 * Both walk the calendar with [calendar-walk.ts](./calendar-walk.ts), so both
 * inherit its coalescing: the last day of January and the first of February
 * are consecutive, and a rule that selects them both covers one interval.
 */

import { matchingDays } from "./calendar-walk.js";
import { type Context, zoneOf } from "./context.js";
import type { IntervalStream } from "./interval-stream.js";
import { MONTHS, type Month } from "./rule.js";

/**
 * Whole days selected by position in the month.
 *
 * A negative day is resolved against the month it lands in rather than against
 * a fixed length, which is the whole point of writing one: `-1` is 28 February
 * in one month and 31 March in the next. A positive day the month never
 * reaches simply does not match, so `31` covers seven months of the year.
 */
export function dayOfMonthIntervals(
  context: Context,
  days: readonly number[],
  zone?: string,
): IntervalStream {
  // Nothing to walk the calendar for. See `matchingDays` for why that matters.
  if (days.length === 0) {
    return [];
  }

  const fromStart = new Set(days.filter((day) => day > 0));
  const fromEnd = new Set(days.filter((day) => day < 0));

  return matchingDays(
    context,
    zoneOf(context, zone),
    (date) =>
      fromStart.has(date.day) || fromEnd.has(date.day - date.daysInMonth - 1),
  );
}

/**
 * Whole days selected by the month they fall in.
 *
 * The names are turned into numbers once rather than the date being turned
 * into a name on every one of the year's days.
 */
export function monthIntervals(
  context: Context,
  months: readonly Month[],
  zone?: string,
): IntervalStream {
  const wanted = new Set(months.map((month) => MONTHS.indexOf(month) + 1));

  if (wanted.size === 0) {
    return [];
  }

  return matchingDays(context, zoneOf(context, zone), (date) =>
    wanted.has(date.month),
  );
}
