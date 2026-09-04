/**
 * Walking the calendar a day at a time, looking for days that match.
 *
 * The rules that select whole days — by weekday, by position in the month, by
 * month — differ only in the predicate. What they share is the walk and the
 * coalescing, and the coalescing is the fiddly part: two selected days that
 * happen to be consecutive are one interval, not two that touch at midnight,
 * and a stream of touching intervals is one the sweeps in `interval-stream.ts`
 * read wrongly.
 */

import type { Context } from "./context.js";
import type { IntervalStream } from "./interval-stream.js";

export function startOfDay(
  date: Temporal.PlainDate,
  zone: string,
  disambiguation: Context["disambiguation"],
): Temporal.ZonedDateTime {
  return date.toPlainDateTime("00:00").toZonedDateTime(zone, {
    disambiguation: disambiguation ?? "compatible",
  });
}

/**
 * Whole days matching a predicate, walked forward from the context, with runs
 * of consecutive matches merged into one interval.
 *
 * Endless unless the context bounds it. The run being built is flushed when the
 * window ends, so a rule that matches every day still terminates — without
 * that, a run that never closes would never yield anything at all.
 *
 * A predicate that can never match is the caller's problem to spot before
 * calling. An unbounded context would otherwise send this forward a day at a
 * time until Temporal's year limit, thousands of centuries later, and report a
 * date range error rather than the empty rule it is.
 */
export function* matchingDays(
  context: Context,
  zone: string,
  matches: (date: Temporal.PlainDate) => boolean,
): IntervalStream {
  const stop = context.to;
  let date = context.from.withTimeZone(zone).toPlainDate();
  let runStart: Temporal.PlainDate | undefined;

  for (;;) {
    const dayStart = startOfDay(date, zone, context.disambiguation);

    if (
      stop !== undefined &&
      Temporal.ZonedDateTime.compare(dayStart, stop) >= 0
    ) {
      if (runStart !== undefined) {
        yield {
          start: startOfDay(runStart, zone, context.disambiguation),
          end: dayStart,
        };
      }
      return;
    }

    if (matches(date)) {
      runStart ??= date;
    } else if (runStart !== undefined) {
      yield {
        start: startOfDay(runStart, zone, context.disambiguation),
        end: dayStart,
      };
      runStart = undefined;
    }

    date = date.add({ days: 1 });
  }
}
