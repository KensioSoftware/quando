/**
 * Every nth period, counted from an anchor date.
 *
 * Another predicate over whole days, so it walks the calendar with
 * [calendar-walk.ts](./calendar-walk.ts) and coalesces the way the rest do.
 * The whole of each selected period is covered, so two weeks in a row come
 * back as one interval.
 *
 * Counting runs in both directions from the anchor. A rule anchored in April
 * covers the right weeks in March, and `onOrAfter` is what bounds one.
 * [every-periods.ts](./every-periods.ts) holds the arithmetic.
 */

import { matchingDays } from "./calendar-walk.js";
import { type Context, zoneOf } from "./context.js";
import { onCycle, periodsBetween } from "./every-periods.js";
import type { IntervalStream } from "./interval-stream.js";
import type { Period } from "./rule.js";

export function everyIntervals(
  context: Context,
  interval: number,
  period: Period,
  anchor: string,
  zone?: string,
): IntervalStream {
  const from = Temporal.PlainDate.from(anchor);

  return matchingDays(context, zoneOf(context, zone), (date) =>
    onCycle(periodsBetween(from, date, period), interval),
  );
}
