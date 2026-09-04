/**
 * A rule covering one stretch of the calendar, bounded at either end or both.
 *
 * Nothing recurs here, so there is no calendar to walk. One interval comes
 * out, and an end left open comes out open. Everything else about the rule is
 * the clipping the caller's window does to it.
 */

import { startOfDay } from "./calendar-walk.js";
import { type Context, zoneOf } from "./context.js";
import type { IntervalStream } from "./interval-stream.js";

export function dateRangeIntervals(
  context: Context,
  from: string | undefined,
  to: string | undefined,
  zone?: string,
): IntervalStream {
  const inZone = zoneOf(context, zone);
  const at = (date: string): Temporal.ZonedDateTime =>
    startOfDay(Temporal.PlainDate.from(date), inZone, context.disambiguation);

  return [
    {
      start: from === undefined ? undefined : at(from),
      // The named day is covered whole, so the interval runs to the start of
      // the day after it. A date names a day here, the way it does in `dates`.
      end:
        to === undefined
          ? undefined
          : at(Temporal.PlainDate.from(to).add({ days: 1 }).toString()),
    },
  ];
}
