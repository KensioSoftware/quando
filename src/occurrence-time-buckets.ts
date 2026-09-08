/**
 * The calendar buckets a time cap has already filled.
 *
 * The sibling of [occurrence-buckets.ts](./occurrence-buckets.ts), which
 * counts occurrences per bucket. This measures how long they went on, so an
 * occurrence spanning midnight fills part of two days rather than counting
 * once against one of them.
 */

import type { Context } from "./context.js";
import { bucketAround } from "./occurrence-buckets.js";
import type { Span } from "./occurrence-depth.js";
import type { Period } from "./rule.js";

/** How much time one bucket holds so far, and which bucket it is. */
interface Filling {
  readonly span: Span;
  used: bigint;
}

/**
 * The buckets already holding the most time they may.
 *
 * A full bucket is out for the whole of itself, including the part before the
 * occurrences that filled it, the same way a full count bucket is.
 */
export function overfullBuckets(
  busy: readonly Span[],
  cap: bigint,
  per: Period,
  zone: string,
  context: Context,
): readonly Span[] {
  const held = new Map<string, Filling>();
  for (const span of busy) {
    fill(held, span, per, zone, context);
  }
  return [...held.values()]
    .filter((bucket) => bucket.used >= cap)
    .map((bucket) => bucket.span);
}

/** Walks the buckets one stretch touches, adding what it puts in each. */
function fill(
  held: Map<string, Filling>,
  span: Span,
  per: Period,
  zone: string,
  context: Context,
): void {
  let cursor = span.start;
  while (Temporal.ZonedDateTime.compare(cursor, span.end) < 0) {
    const bucket = bucketAround(cursor, per, zone, context);
    const closes =
      Temporal.ZonedDateTime.compare(bucket.end, span.end) < 0
        ? bucket.end
        : span.end;
    const used = closes.epochNanoseconds - cursor.epochNanoseconds;

    const key = bucket.start.toString();
    const found = held.get(key);
    if (found === undefined) {
      held.set(key, { span: bucket, used });
    } else {
      found.used += used;
    }
    cursor = bucket.end;
  }
}
