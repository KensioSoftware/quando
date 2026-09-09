/**
 * Walking a covered stream as the local dates it touches.
 *
 * Counting the intervals a stream hands over would give a different and wrong
 * answer. Consecutive covered days coalesce. An all-day weekday schedule yields
 * one Monday-to-Saturday interval per week, and the count of days in it is
 * five. This steps through the dates inside each interval.
 *
 * [calendar-walk.ts](./calendar-walk.ts) walks the calendar looking for days a
 * rule selects. This walks what a rule already produced.
 */

import { type CoverageSource, covered } from "./assigned.js";
import { startOfDay } from "./calendar-walk.js";
import type { Context } from "./context.js";
import type { Interval } from "./interval.js";

/** A covered date, and the first instant on it the input covers. */
export interface CoveredDay {
  readonly date: Temporal.PlainDate;
  readonly opensAt: Temporal.ZonedDateTime;
}

/**
 * Every covered date in order, each one once, with the first covered instant
 * on it.
 *
 * Dates are read in the zone of `context.from`, the zone every other query
 * reads. The stream is ascending and non-overlapping. A date can only repeat
 * immediately after itself, and two openings on one day (a morning and an
 * afternoon) are one covered day, keeping the earlier opening.
 */
export function* coveredDays<V>(
  covers: CoverageSource<V>,
  context: Context,
): Iterable<CoveredDay> {
  const zone = context.from.timeZoneId;
  let last: Temporal.PlainDate | undefined;

  for (const interval of covered(covers, context)) {
    for (const day of daysIn(interval, zone, context.disambiguation)) {
      if (last === undefined || !day.date.equals(last)) {
        yield day;
        last = day.date;
      }
    }
  }
}

/**
 * The dates one interval touches, with the first covered instant on each.
 *
 * An unbounded interval covers no countable dates, on the same reasoning that
 * has `coveredDuration` add nothing for one. Both queries take a window with an
 * end, and everything a rule yields inside one is clipped to it.
 *
 * A date a zone skips outright (Pacific/Apia had no 30 December in 2011) holds
 * no time, and the comparison against the following day's start drops it.
 */
function* daysIn(
  interval: Interval,
  zone: string,
  disambiguation: Context["disambiguation"],
): Iterable<CoveredDay> {
  const { start, end } = interval;
  if (start === undefined || end === undefined) {
    return;
  }

  let date = start.withTimeZone(zone).toPlainDate();
  let dayStart = startOfDay(date, zone, disambiguation);

  while (Temporal.ZonedDateTime.compare(dayStart, end) < 0) {
    const next = date.add({ days: 1 });
    const nextStart = startOfDay(next, zone, disambiguation);
    if (Temporal.ZonedDateTime.compare(dayStart, nextStart) < 0) {
      yield { date, opensAt: later(dayStart, start) };
    }
    date = next;
    dayStart = nextStart;
  }
}

/** The later of two instants. */
function later(
  left: Temporal.ZonedDateTime,
  right: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.compare(left, right) >= 0 ? left : right;
}
