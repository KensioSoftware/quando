/**
 * The calendar buckets a cap counts in, and the ones already full.
 *
 * A rolling window is arithmetic on instants and needs no calendar. A bucket
 * needs one, because the day a thing happened on depends on the zone it is
 * read in and the month it happened in depends on how long the months before
 * it were. That difference is why the two live apart.
 */

import { startOfDay } from "./calendar-walk.js";
import type { Context } from "./context.js";
import type { Span } from "./occurrence-depth.js";
import type { Occurrence } from "./occurrence.js";
import type { Period } from "./rule.js";

/**
 * The calendar buckets already holding the most they may.
 *
 * A full bucket is out for the whole of itself, including the part before the
 * occurrences that filled it. Nothing can be added to a day that is already
 * full, whichever end of it is being asked about.
 */
export function fullBuckets(
  history: readonly Occurrence[],
  count: number,
  per: Period,
  zone: string,
  context: Context,
): readonly Span[] {
  const held = new Map<string, { span: Span; seen: number }>();
  for (const occurrence of history) {
    const span = bucketAround(occurrence.at, per, zone, context);
    const key = span.start.toString();
    const found = held.get(key);
    if (found === undefined) {
      held.set(key, { span, seen: 1 });
    } else {
      found.seen += 1;
    }
  }
  return [...held.values()]
    .filter((bucket) => bucket.seen >= count)
    .map((bucket) => bucket.span);
}

/** The calendar bucket of this kind that an instant falls in. */
export function bucketAround(
  at: Temporal.ZonedDateTime,
  per: Period,
  zone: string,
  context: Omit<Context, "from" | "to"> | undefined,
): Span {
  const date = at.withTimeZone(zone).toPlainDate();
  const first = startOf(date, per);
  const start = startOfDay(first, zone, context?.disambiguation);
  const next = first.add(lengthOf(per));
  return { start, end: startOfDay(next, zone, context?.disambiguation) };
}

/** The first date of the bucket a date belongs to. Weeks run from Monday. */
function startOf(date: Temporal.PlainDate, per: Period): Temporal.PlainDate {
  if (per === "days") {
    return date;
  }
  if (per === "weeks") {
    return date.subtract({ days: date.dayOfWeek - 1 });
  }
  return per === "months"
    ? date.with({ day: 1 })
    : date.with({ month: 1, day: 1 });
}

function lengthOf(per: Period): Temporal.DurationLike {
  switch (per) {
    case "days": {
      return { days: 1 };
    }
    case "weeks": {
      return { weeks: 1 };
    }
    case "months": {
      return { months: 1 };
    }
    case "years": {
      return { years: 1 };
    }
  }
}
