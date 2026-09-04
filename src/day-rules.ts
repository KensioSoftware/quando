/**
 * Rules that select whole days: by weekday, and by date.
 *
 * The weekday rule walks the calendar with
 * [calendar-walk.ts](./calendar-walk.ts) and inherits its coalescing. The date
 * rule does its own walk, over the dates rather than over the calendar, for
 * the reason given where it is written.
 */

import { matchingDays, startOfDay } from "./calendar-walk.js";
import { type Context, zoneOf } from "./context.js";
import type { IntervalStream } from "./interval-stream.js";
import { WEEKDAYS, type Weekday } from "./rule.js";

function weekdayOf(date: Temporal.PlainDate): Weekday | undefined {
  return WEEKDAYS[date.dayOfWeek - 1];
}

/** Whole days selected by day of the week. */
export function weekdayIntervals(
  context: Context,
  days: readonly Weekday[],
  zone?: string,
): IntervalStream {
  const wanted = new Set(days);

  // Nothing to walk the calendar for. See `matchingDays` for why that matters.
  if (wanted.size === 0) {
    return [];
  }

  return matchingDays(context, zoneOf(context, zone), (date) => {
    const weekday = weekdayOf(date);
    return weekday !== undefined && wanted.has(weekday);
  });
}

/**
 * Whole days named by date.
 *
 * Walks the given dates rather than the calendar, so a handful of dates costs a
 * handful of steps however far apart they are, and the stream ends when they
 * do. Sorted and de-duplicated first, because the contract is about the output
 * and callers write dates in whatever order they think of them.
 */
export function* dateIntervals(
  context: Context,
  dates: readonly string[],
  zone?: string,
): IntervalStream {
  const inZone = zoneOf(context, zone);
  const days = [
    ...new Set(dates.map((date) => Temporal.PlainDate.from(date).toString())),
  ]
    .toSorted()
    .map((date) => Temporal.PlainDate.from(date));

  let runStart: Temporal.PlainDate | undefined;
  let runEnd: Temporal.PlainDate | undefined;

  for (const day of days) {
    if (runEnd !== undefined && Temporal.PlainDate.compare(day, runEnd) === 0) {
      // Consecutive with the run so far, so it extends rather than starts one.
      runEnd = day.add({ days: 1 });
      continue;
    }
    if (runStart !== undefined && runEnd !== undefined) {
      yield {
        start: startOfDay(runStart, inZone, context.disambiguation),
        end: startOfDay(runEnd, inZone, context.disambiguation),
      };
    }
    runStart = day;
    runEnd = day.add({ days: 1 });
  }

  if (runStart !== undefined && runEnd !== undefined) {
    yield {
      start: startOfDay(runStart, inZone, context.disambiguation),
      end: startOfDay(runEnd, inZone, context.disambiguation),
    };
  }
}
