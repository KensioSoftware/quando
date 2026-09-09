/**
 * What a cap on total time forbids, given what has already happened.
 *
 * The sibling of the count cap in [occurrence-rules.ts](./occurrence-rules.ts),
 * and a different problem underneath. A count cap asks how many shadows lie on
 * top of each other. A time cap asks how much of a window is occupied, which
 * two occurrences of different lengths answer differently.
 *
 * Overlapping occurrences are merged rather than added up. Nobody is in the
 * Schengen area twice at once, and two driving records over the same hour are
 * a data error rather than two hours of driving.
 */

import { type Context, zoneOf } from "./context.js";
import type { IntervalStream } from "./interval-stream.js";
import { overfullBuckets } from "./occurrence-time-buckets.js";
import { overfullWindows, type Range } from "./occurrence-occupancy.js";
import { atLeastDeep, type Span } from "./occurrence-depth.js";
import { endOf, historyOf, type Occurrence } from "./occurrence.js";
import type { AtMostTimeRule } from "./rule.js";

/** The times a cap on total time rules out. */
export function atMostTimeForbids(
  rule: AtMostTimeRule,
  context: Context,
): IntervalStream {
  const history = historyOf(context.occurrences, "atMostTime");
  const zone = zoneOf(context, rule.zone);
  const busy = busyOf(history);
  const cap = nanosecondsIn(rule.total);

  const shadows =
    rule.within === undefined
      ? overfullBuckets(busy, cap, rule.per, zone, context)
      : rolling(busy, cap, rule.within, zone);
  return atLeastDeep(shadows, 1);
}

/**
 * The time the history occupies, merged into one non-overlapping set.
 *
 * `atLeastDeep(…, 1)` is the merge, and it drops the occurrences that took no
 * time on the way through. A moment fills no part of a window.
 */
export function busyOf(history: readonly Occurrence[]): readonly Span[] {
  return atLeastDeep(
    history.map((occurrence) => ({
      start: occurrence.at,
      end: endOf(occurrence),
    })),
    1,
  );
}

/** The rolling case, which counts in epoch nanoseconds and comes back out. */
function rolling(
  busy: readonly Span[],
  cap: bigint,
  within: string,
  zone: string,
): readonly Span[] {
  const ranges: Range[] = busy.map((span) => ({
    start: span.start.epochNanoseconds,
    end: span.end.epochNanoseconds,
  }));
  return overfullWindows(ranges, cap, nanosecondsIn(within)).map((range) => ({
    start: at(range.start, zone),
    end: at(range.end, zone),
  }));
}

function at(nanoseconds: bigint, zone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochNanoseconds(nanoseconds).toZonedDateTimeISO(
    zone,
  );
}

/**
 * An ISO duration as a count of nanoseconds.
 *
 * Written out rather than taken from `total()`, which returns a `number` and
 * loses nanoseconds somewhere around a hundred days. A rolling 180 is past
 * that. The day of 24 hours the cap is read with is the multiplier below.
 */
export function nanosecondsIn(duration: string): bigint {
  const parts = Temporal.Duration.from(duration);
  return (
    BigInt(parts.days) * 86_400_000_000_000n +
    BigInt(parts.hours) * 3_600_000_000_000n +
    BigInt(parts.minutes) * 60_000_000_000n +
    BigInt(parts.seconds) * 1_000_000_000n +
    BigInt(parts.milliseconds) * 1_000_000n +
    BigInt(parts.microseconds) * 1000n +
    BigInt(parts.nanoseconds)
  );
}
