/**
 * The rule that selects a wall-clock window within each day.
 *
 * Wall clock rather than elapsed time is the whole point: across a daylight
 * saving transition the clock times stay put and the real length of the window
 * changes, which is what a schedule means by "nine to five".
 */

import { type Context, zoneOf } from "./context.js";
import type { IntervalStream } from "./interval-stream.js";

/**
 * A wall-clock window within each day, endless unless the context bounds it.
 *
 * Starts a day earlier than the context does, because a window that wraps past
 * midnight may have opened yesterday and still be running. Clipping to the
 * window drops whatever that turns up too early.
 */
export function* timeOfDayIntervals(
  context: Context,
  from: string,
  to: string,
  zone?: string,
): IntervalStream {
  const inZone = zoneOf(context, zone);
  const opens = Temporal.PlainTime.from(from);
  const closes = Temporal.PlainTime.from(to);

  if (Temporal.PlainTime.compare(opens, closes) === 0) {
    throw new RangeError(
      `A time-of-day window from ${from} to ${to} has the same start and end. ` +
        `Use { type: "always" } for a whole day.`,
    );
  }

  // Earlier `to` than `from` means the window runs past midnight into the day
  // after — a night shift, not an empty window.
  const wraps = Temporal.PlainTime.compare(closes, opens) < 0;
  const stop = context.to;
  let date = context.from
    .withTimeZone(inZone)
    .toPlainDate()
    .subtract({ days: 1 });

  for (;;) {
    const start = date.toPlainDateTime(opens).toZonedDateTime(inZone, {
      disambiguation: context.disambiguation ?? "compatible",
    });
    if (
      stop !== undefined &&
      Temporal.ZonedDateTime.compare(start, stop) >= 0
    ) {
      return;
    }

    const closing = wraps ? date.add({ days: 1 }) : date;
    const end = closing.toPlainDateTime(closes).toZonedDateTime(inZone, {
      disambiguation: context.disambiguation ?? "compatible",
    });

    // A window can collapse to nothing on the morning clocks go forward. Both
    // ends of 01:00-02:00 in London on 2026-03-29 resolve to the same instant,
    // because the hour between them does not exist and Temporal's default
    // disambiguation moves a nonexistent time forward to the far side of the
    // gap. Yielding that would put a zero-length interval into a stream whose
    // contract says there are none.
    if (Temporal.ZonedDateTime.compare(start, end) < 0) {
      yield { start, end };
    }

    date = date.add({ days: 1 });
  }
}
