/**
 * Streams of intervals that carry values, and the operations resolution needs
 * over them.
 *
 * The same shape as `interval-stream.ts` one level down, and deliberately
 * separate from it. Those sweeps are set algebra over *when*, and nothing in
 * them has an opinion about values. {@link overlay} is where an opinion is
 * needed, and it is handed one rather than choosing.
 */

import type { Valued } from "./cascade.js";
import { compareEnds, compareStarts, earlierEnd } from "./interval.js";
import type { Merge } from "./merge.js";
import { type Peekable, peekable } from "./stream.js";

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
 * Two streams laid over one another, with `merge` settling the overlap.
 *
 * Where only one covers a moment, its value comes through. Where both do, the
 * two values go to `merge`, `under` first. Where neither does, the moment is
 * absent, the same as everywhere else in the library.
 *
 * It walks both fronts and cuts whichever runs on at the other's boundary, so
 * it pulls only as far as the next piece of the answer and stays lazy over
 * endless sources.
 *
 * Output is not coalesced. Cutting at every boundary splits runs carrying the
 * same value on both sides, and {@link coalesce} over the top puts them back.
 * Teaching this sweep to look ahead instead would buy nothing.
 */
export function* overlay<V>(
  under: ValuedStream<V>,
  over: ValuedStream<V>,
  merge: Merge<V>,
): ValuedStream<V> {
  const a = peekable(under);
  const b = peekable(over);

  // What is left of each front interval. A stretch already yielded is cut off
  // the front rather than yielded twice, which is what keeps this to one pass
  // over sources that can only be read forwards.
  let restA = a.peek();
  let restB = b.peek();

  for (;;) {
    if (restA === undefined || restB === undefined) {
      yield* remainder(restA ?? restB, restA === undefined ? b : a);
      return;
    }

    const order = compareStarts(restA.start, restB.start);

    if (order === 0) {
      // Both cover the stretch up to whichever ends first, and that stretch is
      // the only place `merge` is ever called.
      const end = earlierEnd(restA.end, restB.end);
      yield { start: restA.start, end, value: merge(restA.value, restB.value) };
      const cutA = cut(restA, end, a);
      restB = cut(restB, end, b);
      restA = cutA;
      continue;
    }

    // One of them starts first and holds alone until the other begins. Its own
    // end may come first, in which case the whole of it stands alone.
    if (order < 0) {
      const boundary = restB.start;
      if (compareEnds(restA.end, boundary) <= 0) {
        yield restA;
        a.drop();
        restA = a.peek();
        continue;
      }
      yield { start: restA.start, end: boundary, value: restA.value };
      restA = { ...restA, start: boundary };
      continue;
    }

    const boundary = restA.start;
    if (compareEnds(restB.end, boundary) <= 0) {
      yield restB;
      b.drop();
      restB = b.peek();
      continue;
    }
    yield { start: restB.start, end: boundary, value: restB.value };
    restB = { ...restB, start: boundary };
  }
}

/**
 * Whatever is left of one side once the other is spent, beginning with the
 * piece already in hand.
 *
 * That piece may have been cut short, so it is yielded from the local rather
 * than read again from the source, and the source's own copy of it dropped.
 */
function* remainder<V>(
  held: Valued<V> | undefined,
  source: Peekable<Valued<V>>,
): ValuedStream<V> {
  if (held === undefined) {
    return;
  }
  yield held;
  source.drop();

  for (;;) {
    const next = source.peek();
    if (next === undefined) {
      return;
    }
    source.drop();
    yield next;
  }
}

/**
 * What is left of an interval once the stretch up to `end` has been yielded.
 *
 * An interval used up entirely is dropped and the next one pulled, so the
 * front always holds something still to yield.
 */
function cut<V>(
  interval: Valued<V>,
  end: Temporal.ZonedDateTime | undefined,
  source: Peekable<Valued<V>>,
): Valued<V> | undefined {
  if (end === undefined || compareEnds(interval.end, end) <= 0) {
    source.drop();
    return source.peek();
  }
  return { ...interval, start: end };
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
