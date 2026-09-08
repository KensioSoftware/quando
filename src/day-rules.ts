/**
 * Rules that select whole days: by weekday, and by date.
 *
 * The weekday rule walks the calendar with
 * [calendar-walk.ts](./calendar-walk.ts) and inherits its coalescing. The date
 * rule walks the dates rather than the calendar, and
 * [date-runs.ts](./date-runs.ts) is where it reads them.
 */

import { matchingDays, startOfDay } from "./calendar-walk.js";
import { type Context, zoneOf } from "./context.js";
import { dateRuns, runsFrom } from "./date-runs.js";
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
 * Walks the given dates rather than the calendar, so a handful of dates costs
 * a handful of steps however far apart they are, and the stream ends when they
 * do.
 *
 * It starts at the window rather than at the first date, so a long list costs
 * little either. Turning a date into an instant is the expensive step, and
 * only the days the window can reach are worth paying it for. `clip` trims the
 * two runs on the edges, as it always did.
 */
export function* dateIntervals(
  context: Context,
  dates: readonly string[],
  zone?: string,
): IntervalStream {
  const inZone = zoneOf(context, zone);
  const runs = dateRuns(dates);
  const opens = context.from.withTimeZone(inZone).toPlainDate();
  const closes = context.to?.withTimeZone(inZone).toPlainDate();

  for (const run of runsFrom(runs, opens)) {
    // A run starting after the window's last date begins at or after the
    // window ends, and so does every run behind it.
    if (
      closes !== undefined &&
      Temporal.PlainDate.compare(run.from, closes) > 0
    ) {
      return;
    }
    yield {
      start: startOfDay(run.from, inZone, context.disambiguation),
      end: startOfDay(run.to, inZone, context.disambiguation),
    };
  }
}
