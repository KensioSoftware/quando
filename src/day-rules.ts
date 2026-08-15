/**
 * Rules that select whole days: by weekday, and by date.
 *
 * Both uphold the stream contract — sorted, not overlapping, coalesced — and
 * the coalescing is the fiddly part. Two selected days that happen to be
 * consecutive are one interval, not two that touch at midnight, and a stream of
 * touching intervals is one the sweeps in `interval-stream.ts` read wrongly.
 */

import { type Context, zoneOf } from "./context.js";
import type { IntervalStream } from "./interval-stream.js";
import { WEEKDAYS, type Weekday } from "./rule.js";

function startOfDay(
  date: Temporal.PlainDate,
  zone: string,
): Temporal.ZonedDateTime {
  return date.toZonedDateTime({ timeZone: zone, plainTime: "00:00" });
}

function weekdayOf(date: Temporal.PlainDate): Weekday | undefined {
  return WEEKDAYS[date.dayOfWeek - 1];
}

/**
 * Whole days matching a predicate, walked forward from the context, with runs
 * of consecutive matches merged into one interval.
 *
 * Endless unless the context bounds it. The run being built is flushed when the
 * window ends, so a rule that matches every day still terminates — without
 * that, a run that never closes would never yield anything at all.
 */
function* matchingDays(
  context: Context,
  zone: string,
  matches: (date: Temporal.PlainDate) => boolean,
): IntervalStream {
  const stop = context.to;
  let date = context.from.withTimeZone(zone).toPlainDate();
  let runStart: Temporal.PlainDate | undefined;

  for (;;) {
    const dayStart = startOfDay(date, zone);

    if (
      stop !== undefined &&
      Temporal.ZonedDateTime.compare(dayStart, stop) >= 0
    ) {
      if (runStart !== undefined) {
        yield { start: startOfDay(runStart, zone), end: dayStart };
      }
      return;
    }

    if (matches(date)) {
      runStart ??= date;
    } else if (runStart !== undefined) {
      yield { start: startOfDay(runStart, zone), end: dayStart };
      runStart = undefined;
    }

    date = date.add({ days: 1 });
  }
}

/** Whole days selected by day of the week. */
export function weekdayIntervals(
  context: Context,
  days: readonly Weekday[],
  zone?: string,
): IntervalStream {
  const wanted = new Set(days);
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
        start: startOfDay(runStart, inZone),
        end: startOfDay(runEnd, inZone),
      };
    }
    runStart = day;
    runEnd = day.add({ days: 1 });
  }

  if (runStart !== undefined && runEnd !== undefined) {
    yield {
      start: startOfDay(runStart, inZone),
      end: startOfDay(runEnd, inZone),
    };
  }
}
