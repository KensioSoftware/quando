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
import { calendarOf, type Context, isIsoCalendar, zoneOf } from "./context.js";
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
  const calendar = calendarOf(context);
  if (!isIsoCalendar(calendar) && (period === "months" || period === "years")) {
    throw new RangeError(
      `every() counts ${period} on the Gregorian calendar, so it cannot be ` +
        `read on the ${calendar} calendar. A year there may hold thirteen ` +
        "months. Count days or weeks, which every calendar agrees about.",
    );
  }

  // Read on the same calendar as the days being walked. `until` refuses two
  // dates that disagree about which calendar they are on, and the anchor is
  // written as an ISO date whatever calendar the rule counts in.
  const from = Temporal.PlainDate.from(anchor).withCalendar(calendar);

  return matchingDays(context, zoneOf(context, zone), (date) =>
    onCycle(periodsBetween(from, date, period), interval),
  );
}
