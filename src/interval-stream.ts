/**
 * The interval algebra: intersection, union and complement over lazy streams.
 *
 * Streams are `Iterable`, and may be infinite — a weekly recurrence genuinely
 * has no end, and modelling it as though it did would put callers back to
 * guessing a window large enough to hold an answer they cannot predict.
 *
 * Every operation here is a sweep: it pulls from its sources only as far as it
 * needs to produce the next result, so `take(3)` from an infinite intersection
 * pulls a handful of intervals rather than expanding a year.
 */

import {
  compareEnds,
  compareStarts,
  earlierEnd,
  type Interval,
  isEmpty,
  laterEnd,
  laterStart,
  startsAtOrBeforeEnd,
  startsBeforeEnd,
} from "./interval.js";
import { type Peekable, peekable } from "./stream.js";

/**
 * A lazy sequence of intervals.
 *
 * **Contract, which every producer must uphold:** intervals arrive in
 * *ascending* order of start, do not overlap, and are already coalesced — no
 * two touching intervals where one would do. The sweeps below are single-pass
 * and rely on all three; a producer that breaks one produces wrong answers
 * rather than errors.
 *
 * Ascending is stated rather than implied because the opposite is a real thing
 * to want later: "when did this last open" wants to walk backwards. A
 * descending stream would satisfy every other clause here while being read
 * wrongly by all of it, so if one is ever added it needs to be a distinct type
 * rather than a stream that happens to run the other way.
 */
export type IntervalStream = Iterable<Interval>;

/**
 * The times both streams cover.
 *
 * Terminates when either source does. Note that it will *not* terminate on two
 * infinite sources that never overlap — there is nothing it could inspect to
 * discover that the answer is empty. See the note on unbounded queries in the
 * documentation; that case is the caller's to bound.
 */
export function* intersect(
  left: IntervalStream,
  right: IntervalStream,
): IntervalStream {
  const a = peekable(left);
  const b = peekable(right);

  for (;;) {
    const x = a.peek();
    const y = b.peek();
    if (x === undefined || y === undefined) {
      return;
    }

    const start = laterStart(x.start, y.start);
    const end = earlierEnd(x.end, y.end);
    if (startsBeforeEnd(start, end)) {
      yield { start, end };
    }

    // Drop whichever ends first: the other may still overlap what follows it.
    if (compareEnds(x.end, y.end) <= 0) {
      a.drop();
    } else {
      b.drop();
    }
  }
}

/**
 * The times either stream covers, coalesced.
 *
 * Touching intervals are merged as well as overlapping ones, so the output
 * satisfies the stream contract rather than merely being correct as a set.
 */
export function* union(
  left: IntervalStream,
  right: IntervalStream,
): IntervalStream {
  const a = peekable(left);
  const b = peekable(right);
  let open: Interval | undefined;

  for (;;) {
    const next = takeEarlier(a, b);
    if (next === undefined) {
      break;
    }

    if (open === undefined) {
      open = next;
    } else if (startsAtOrBeforeEnd(next.start, open.end)) {
      open = { start: open.start, end: laterEnd(open.end, next.end) };
    } else {
      yield open;
      open = next;
    }

    // Nothing can extend an interval that already runs to the unbounded
    // future, so there is no reason to keep pulling — and every reason not to,
    // since either source may be infinite and this would never yield at all.
    if (open.end === undefined) {
      yield open;
      return;
    }
  }

  if (open !== undefined) {
    yield open;
  }
}

/** Consume whichever stream's next interval starts earlier. */
function takeEarlier(
  a: Peekable<Interval>,
  b: Peekable<Interval>,
): Interval | undefined {
  const x = a.peek();
  const y = b.peek();

  if (x === undefined) {
    if (y === undefined) {
      return undefined;
    }
    b.drop();
    return y;
  }
  if (y === undefined) {
    a.drop();
    return x;
  }

  if (compareStarts(x.start, y.start) <= 0) {
    a.drop();
    return x;
  }
  b.drop();
  return y;
}

/**
 * The times a stream does not cover — the gaps, plus the unbounded stretches
 * before the first interval and after the last.
 *
 * On an infinite source the trailing stretch is never reached, which is correct:
 * there is no "after the last" when there is no last.
 */
export function* complement(source: IntervalStream): IntervalStream {
  /** Where the next gap begins: the end of the interval last seen. */
  let cursor: Temporal.ZonedDateTime | undefined;
  let seenAny = false;

  for (const interval of source) {
    // A zero-length interval covers nothing, so it neither opens a gap nor
    // closes one. Letting it through would split the surrounding gap into two
    // touching halves, and a stream of touching intervals is one this module's
    // own sweeps would then read wrongly.
    if (isEmpty(interval)) {
      continue;
    }

    if (!seenAny) {
      seenAny = true;
      // The stretch before the first interval — unless the source itself begins
      // at the unbounded past, in which case there is nothing before it. An
      // absent `start` and an absent `end` mean opposite things, so this case
      // has to be handled rather than falling out of a comparison.
      if (interval.start !== undefined) {
        yield { start: undefined, end: interval.start };
      }
    } else if (
      cursor !== undefined &&
      interval.start !== undefined &&
      Temporal.ZonedDateTime.compare(cursor, interval.start) < 0
    ) {
      yield { start: cursor, end: interval.start };
    }

    if (interval.end === undefined) {
      // The source runs to the unbounded future; nothing can follow it.
      return;
    }
    cursor = interval.end;
  }

  // An exhausted source leaves everything after it uncovered. An empty one
  // leaves everything uncovered, which is the same statement with no cursor.
  yield { start: seenAny ? cursor : undefined, end: undefined };
}

/**
 * A stream limited to a window.
 *
 * This is what makes a composition over infinite sources terminate: bounded
 * inputs run out, so the sweep above them runs out too. It relies on the
 * sorted-by-start contract to stop early rather than draining its source.
 */
export function clip(source: IntervalStream, window: Interval): IntervalStream {
  // Intersection with a single-interval stream, which is what clipping is. The
  // early stop falls out of it: once the window is consumed the sweep has
  // nothing left to intersect against and returns, so an infinite source is
  // never drained.
  return intersect(source, [window]);
}
