/**
 * How much time a cap counts as used at one instant.
 *
 * The sibling of [constraint-counting.ts](./constraint-counting.ts). The
 * evaluator works from the occurrences out to the stretches they rule out, and
 * by the time an explanation asks, the stream of intervals has forgotten how
 * much time made it. So the total is taken here, from the history.
 *
 * The bucket comes from [occurrence-buckets.ts](./occurrence-buckets.ts), the
 * same function the evaluator uses, for the same reason the count version does
 * it: a second answer to "which day is this in" would drift from the first.
 */

import type { Context } from "./context.js";
import { bucketAround } from "./occurrence-buckets.js";
import type { Span } from "./occurrence-depth.js";
import { busyOf, nanosecondsIn } from "./occurrence-time.js";
import type { Occurrence } from "./occurrence.js";
import type { AtMostTimeRule } from "./rule.js";
import { plannedOccurrence } from "./plan-context.js";

/**
 * How much of the cap's window is taken up at this instant.
 *
 * The rolling window is the one ending here. The calendar bucket is the one
 * holding this instant, measured whole, because a full day is full whichever
 * end of it is being asked about.
 */
export function occupiedFor(
  rule: AtMostTimeRule,
  at: Temporal.ZonedDateTime,
  history: readonly Occurrence[],
  read: Omit<Context, "from" | "to"> | undefined,
): Temporal.Duration {
  // The rolling window is measured back in exact time, the way the sweep in
  // `occurrence-occupancy.ts` measures it. Subtracting the duration from the
  // instant would use calendar arithmetic, and the two would then disagree by
  // an hour about any window spanning a clock change.
  const window =
    rule.within === undefined
      ? bucketAround(at, rule.per, rule.zone ?? at.timeZoneId, read)
      : { start: earlier(at, rule.within), end: at };

  let total = 0n;
  const candidate = plannedOccurrence(read ?? {});
  for (const span of busyOf(
    candidate === undefined ? history : [...history, candidate],
  )) {
    total += overlap(span, window);
  }
  return Temporal.Duration.from({ nanoseconds: 0 }).add({
    seconds: Number(total / 1_000_000_000n),
    nanoseconds: Number(total % 1_000_000_000n),
  });
}

/** How much of a window one busy stretch fills, in nanoseconds. */
function overlap(span: Span, window: Span): bigint {
  const start =
    Temporal.ZonedDateTime.compare(span.start, window.start) > 0
      ? span.start
      : window.start;
  const end =
    Temporal.ZonedDateTime.compare(span.end, window.end) < 0
      ? span.end
      : window.end;
  const filled = end.epochNanoseconds - start.epochNanoseconds;
  return filled > 0n ? filled : 0n;
}

/** The instant one exact length of time before another. */
function earlier(
  at: Temporal.ZonedDateTime,
  width: string,
): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochNanoseconds(
    at.epochNanoseconds - nanosecondsIn(width),
  ).toZonedDateTimeISO(at.timeZoneId);
}
