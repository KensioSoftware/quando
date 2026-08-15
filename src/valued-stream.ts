/**
 * Streams of intervals that carry values, and the two operations resolution
 * needs over them.
 *
 * The same shape as `interval-stream.ts` one level down, and deliberately
 * separate from it: those sweeps are set algebra over *when*, and nothing in
 * them has an opinion about values. These two do nothing but carry values
 * along, which is why neither needs the overlap arithmetic next door.
 */

import type { Valued } from "./cascade.js";
import { compareStarts } from "./interval.js";
import { peekable } from "./stream.js";

/**
 * A lazy sequence of valued intervals.
 *
 * Same contract as `IntervalStream` — ascending by start, non-overlapping,
 * coalesced — with one addition: touching intervals carrying the same value
 * are merged, so where two intervals do touch, the values on either side of
 * the boundary differ.
 */
export type ValuedStream<V> = Iterable<Valued<V>>;

/**
 * One ascending stream from many.
 *
 * The sources are disjoint by construction — a moment is won by exactly one
 * layer — so this only has to take whichever starts earliest, with none of the
 * overlap arithmetic the interval sweeps need.
 */
export function* interleave<V>(
  sources: readonly ValuedStream<V>[],
): ValuedStream<V> {
  const fronts = sources.map((source) => peekable(source));

  for (;;) {
    let earliest: Valued<V> | undefined;
    let from: (typeof fronts)[number] | undefined;

    for (const front of fronts) {
      const next = front.peek();
      if (
        next !== undefined &&
        (earliest === undefined ||
          compareStarts(next.start, earliest.start) < 0)
      ) {
        earliest = next;
        from = front;
      }
    }

    if (from === undefined || earliest === undefined) {
      return;
    }
    from.drop();
    yield earliest;
  }
}

/**
 * Adjacent intervals carrying the same value are one interval.
 *
 * Without this, a run that happens to be split across two layers comes back as
 * two touching intervals with equal values — the same assignment said twice,
 * and a stream that no longer satisfies the coalesced contract the rest of the
 * library keeps.
 *
 * Sameness is `Object.is`, so primitives and shared references merge while
 * structurally-equal objects do not. That is the conservative way round: it
 * splits an interval that could have been merged rather than merging two the
 * caller meant to keep apart.
 */
export function* coalesce<V>(source: ValuedStream<V>): ValuedStream<V> {
  let open: Valued<V> | undefined;

  for (const next of source) {
    if (open === undefined) {
      open = next;
      continue;
    }
    if (Object.is(open.value, next.value) && touches(open, next)) {
      open = { ...open, end: next.end };
      continue;
    }
    yield open;
    open = next;
  }

  if (open !== undefined) {
    yield open;
  }
}

/** Whether one interval ends exactly where the next begins. */
function touches(open: Valued<unknown>, next: Valued<unknown>): boolean {
  return (
    open.end !== undefined &&
    next.start !== undefined &&
    Temporal.ZonedDateTime.compare(open.end, next.start) === 0
  );
}
