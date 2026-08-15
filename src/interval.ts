/**
 * Intervals, and the comparisons the interval algebra is built from.
 *
 * An interval is half open: it includes its start and excludes its end. That is
 * the only choice that makes boundaries unambiguous — under a closed interval a
 * day ending at 17:00 and one beginning at 17:00 both contain that instant, and
 * every boundary query has to pick a side.
 */

/**
 * A span of time, half open: `[start, end)`.
 *
 * Either end may be `undefined`, which means unbounded. Position says which
 * direction: an absent `start` is the unbounded past, an absent `end` the
 * unbounded future. Both are real — "closed indefinitely from 2030" has no end,
 * and the complement of any rule has no beginning.
 */
export interface Interval {
  readonly start: Temporal.ZonedDateTime | undefined;
  readonly end: Temporal.ZonedDateTime | undefined;
}

/**
 * Compare two interval starts, where `undefined` is the unbounded past and so
 * sorts before everything.
 */
export function compareStarts(
  a: Temporal.ZonedDateTime | undefined,
  b: Temporal.ZonedDateTime | undefined,
): number {
  if (a === undefined) {
    return b === undefined ? 0 : -1;
  }
  if (b === undefined) {
    return 1;
  }
  return Temporal.ZonedDateTime.compare(a, b);
}

/**
 * Compare two interval ends, where `undefined` is the unbounded future and so
 * sorts after everything.
 *
 * Separate from {@link compareStarts} because `undefined` means the opposite
 * thing in the two positions, and a single comparison that took both would need
 * telling which it was looking at anyway.
 */
export function compareEnds(
  a: Temporal.ZonedDateTime | undefined,
  b: Temporal.ZonedDateTime | undefined,
): number {
  if (a === undefined) {
    return b === undefined ? 0 : 1;
  }
  if (b === undefined) {
    return -1;
  }
  return Temporal.ZonedDateTime.compare(a, b);
}

/** The earlier of two starts. */
export function earlierStart(
  a: Temporal.ZonedDateTime | undefined,
  b: Temporal.ZonedDateTime | undefined,
): Temporal.ZonedDateTime | undefined {
  return compareStarts(a, b) <= 0 ? a : b;
}

/** The later of two starts. */
export function laterStart(
  a: Temporal.ZonedDateTime | undefined,
  b: Temporal.ZonedDateTime | undefined,
): Temporal.ZonedDateTime | undefined {
  return compareStarts(a, b) >= 0 ? a : b;
}

/** The earlier of two ends. */
export function earlierEnd(
  a: Temporal.ZonedDateTime | undefined,
  b: Temporal.ZonedDateTime | undefined,
): Temporal.ZonedDateTime | undefined {
  return compareEnds(a, b) <= 0 ? a : b;
}

/** The later of two ends. */
export function laterEnd(
  a: Temporal.ZonedDateTime | undefined,
  b: Temporal.ZonedDateTime | undefined,
): Temporal.ZonedDateTime | undefined {
  return compareEnds(a, b) >= 0 ? a : b;
}

/**
 * Whether a start falls strictly before an end, which is what makes an interval
 * non-empty. Either being unbounded settles it: nothing precedes the unbounded
 * past and nothing follows the unbounded future.
 */
export function startsBeforeEnd(
  start: Temporal.ZonedDateTime | undefined,
  end: Temporal.ZonedDateTime | undefined,
): boolean {
  if (start === undefined || end === undefined) {
    return true;
  }
  return Temporal.ZonedDateTime.compare(start, end) < 0;
}

/**
 * Whether a start falls at or before an end.
 *
 * The difference from {@link startsBeforeEnd} is what separates *touching* from
 * *overlapping*, which is the test a union needs: `[09:00,12:00)` and
 * `[12:00,17:00)` do not overlap, but they should still coalesce into one.
 */
export function startsAtOrBeforeEnd(
  start: Temporal.ZonedDateTime | undefined,
  end: Temporal.ZonedDateTime | undefined,
): boolean {
  if (start === undefined || end === undefined) {
    return true;
  }
  return Temporal.ZonedDateTime.compare(start, end) <= 0;
}

/** Whether an interval contains no time at all. */
export function isEmpty(interval: Interval): boolean {
  return !startsBeforeEnd(interval.start, interval.end);
}

/**
 * Whether an instant falls inside an interval. Half open, so an instant exactly
 * at `end` is outside.
 */
export function contains(
  interval: Interval,
  at: Temporal.ZonedDateTime,
): boolean {
  return (
    compareStarts(interval.start, at) <= 0 && compareEnds(at, interval.end) < 0
  );
}

/**
 * How long an interval lasts in exact time, or `undefined` if it is unbounded
 * and so has no finite length.
 *
 * Exact rather than wall clock: this is elapsed time, and across a daylight
 * saving transition the two disagree. A `ZonedDateTime` knows its own offset,
 * so `until` measures the real elapsed duration — 09:00 to 17:00 is eight hours
 * on a transition day only because the transition falls outside it.
 */
export function duration(interval: Interval): Temporal.Duration | undefined {
  const { start, end } = interval;
  if (start === undefined || end === undefined) {
    return undefined;
  }
  return start.until(end, { largestUnit: "hour" });
}
