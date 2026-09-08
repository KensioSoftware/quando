/**
 * What a constraint forbids, given what has already happened.
 *
 * Each of these returns the times the constraint rules *out*, and
 * [interpret.ts](./interpret.ts) complements it. Written that way round
 * because a constraint is naturally a prohibition. An occurrence casts a
 * shadow over the times another one may not go, and everything outside every
 * shadow is permitted.
 *
 * The shadows arrive unsorted and overlapping, so each function hands them to
 * `atLeastDeep(…, 1)`, which sorts, merges and coalesces them into the
 * ascending non-overlapping stream the algebra requires.
 */

import { type Context, zoneOf } from "./context.js";
import type { IntervalStream } from "./interval-stream.js";
import { fullBuckets } from "./occurrence-buckets.js";
import { atLeastDeep, type Span } from "./occurrence-depth.js";
import { endOf, historyOf, type Occurrence } from "./occurrence.js";
import type { AtMostRule, ConstraintRule, SpacedByRule } from "./rule.js";

/** The times a constraint rules out, whichever kind it is. */
export function constraintForbids(
  rule: ConstraintRule,
  context: Context,
): IntervalStream {
  return rule.type === "atMost"
    ? atMostForbids(rule, context)
    : spacedByForbids(rule, context);
}

/** The times a cap rules out. */
function atMostForbids(rule: AtMostRule, context: Context): IntervalStream {
  const history = historyOf(context.occurrences, "atMost");
  const zone = zoneOf(context, rule.zone);
  const shadows =
    rule.within === undefined
      ? fullBuckets(history, rule.count, rule.per, zone, context)
      : crowdedWindows(history, rule.count, rule.within);
  return atLeastDeep(shadows, 1);
}

/**
 * The stretches where a rolling window is already full.
 *
 * An occurrence at X sits inside every window ending in `[X, X + within)`, so
 * that stretch is its shadow. Where `count` shadows lie on top of each other,
 * a window holding `count` occurrences already exists and one more would make
 * it too many.
 */
function crowdedWindows(
  history: readonly Occurrence[],
  count: number,
  within: string,
): readonly Span[] {
  const width = Temporal.Duration.from(within);
  const shadows = history.map((occurrence) => ({
    start: occurrence.at,
    end: occurrence.at.add(width),
  }));
  return atLeastDeep(shadows, count);
}

/**
 * The times a spacing rules out.
 *
 * An occurrence running `[at, end)` puts every instant closer than `gap` to
 * either of its ends out of reach. The near end is open. An instant exactly
 * `gap` away is far enough, so the shadow opens a nanosecond after it.
 */
function spacedByForbids(rule: SpacedByRule, context: Context): IntervalStream {
  const history = historyOf(context.occurrences, "spacedBy");
  const gap = Temporal.Duration.from(rule.gap);
  return atLeastDeep(
    history.map((occurrence) => ({
      start: occurrence.at.subtract(gap).add({ nanoseconds: 1 }),
      end: endOf(occurrence).add(gap),
    })),
    1,
  );
}
