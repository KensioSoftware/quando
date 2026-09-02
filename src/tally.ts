/**
 * How many, in the words people use for counting.
 *
 * The same relationship to [merging](./merge.ts) that a
 * [schedule](./schedule.ts) has to a cascade. `merged("sum", layer(…),
 * layer(…))` says what it does, and it asks the reader to know three things
 * first: that layers overlap, that an overlap is what combines, and what a
 * bare `"sum"` in the first argument governs. Nobody staffing a warehouse
 * says any of that. They say three on weekdays, two more on the eleventh.
 *
 * A `Tally` *is* a `Cascade<number>` with `merge: "sum"`, so everything that
 * takes a cascade takes one of these, and it serialises to the document a
 * hand-written one would.
 */

import { valueAt } from "./assigned.js";
import { always } from "./build.js";
import {
  type Cascade,
  cascade,
  type Layer,
  layer,
  replace,
} from "./cascade.js";
import { duration } from "./interval.js";
import { asDays, type PlainRule } from "./plain-forms.js";
import { resolve } from "./resolve.js";
import type { ValuedStream } from "./valued-stream.js";

/** Zero, as a duration to accumulate onto. */
const NOTHING = Temporal.Duration.from({ seconds: 0 });

/** How many there are over time, and the questions worth asking about that. */
export interface Tally extends Cascade<number> {
  /**
   * That much more, on top of whatever else covers the same time.
   *
   * The verb a tally is mostly written in. Two teams each putting three
   * people on a Monday have six people on that Monday.
   */
  readonly plus: (scope: PlainRule, amount: number) => Tally;

  /**
   * That many for these times, in place of whatever was said before.
   *
   * Instead of, not as well as. A skeleton crew on Christmas Eve is a figure
   * that replaces the usual one, and writing it as a `plus` would need the
   * author to know what they were adding to.
   *
   * "Exactly" is about the figure rather than the last word on it. This
   * outranks every line above it, and a `plus` written afterwards still adds,
   * the same way `hoursOn` works on a [schedule](./schedule.ts).
   */
  readonly exactly: (scope: PlainRule, amount: number) => Tally;

  /**
   * How many at that moment.
   *
   * Zero where no layer claims the moment. A cascade leaves an unclaimed
   * moment out of its stream, and nobody rostered is nobody there, so this
   * reads it as the figure it is. The same call
   * [`isOpen`](./schedule.ts) makes for a schedule.
   */
  readonly at: (at: Temporal.ZonedDateTime) => number;

  /**
   * The lowest figure anywhere between two moments.
   *
   * The question capacity is really asking. A stretch that no layer claims
   * counts as zero, so a window with a gap in it answers zero however well
   * covered the rest of it is.
   */
  readonly least: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
  ) => number;

  /**
   * Each stretch between two moments, and how many are on for it.
   *
   * Leave `to` out for an endless run of them, which is lazy and safe to stop
   * pulling from whenever you have enough.
   */
  readonly counts: (
    from: Temporal.ZonedDateTime,
    to?: Temporal.ZonedDateTime,
  ) => ValuedStream<number>;
}

/**
 * A figure that claims its scope outright.
 *
 * The inner cascade covers the whole of the region this layer wins, which is
 * what `always` means once it is resolved against that region rather than
 * against the context.
 */
function fixed(scope: PlainRule, amount: number): Layer<number> {
  const figure = cascade(layer(always(), amount));
  return replace(asDays(scope), figure);
}

function build(layers: readonly Layer<number>[]): Tally {
  const self: Tally = {
    type: "cascade",
    merge: "sum",
    layers,

    plus: (scope, amount) => build([...layers, layer(asDays(scope), amount)]),

    exactly: (scope, amount) => build([...layers, fixed(scope, amount)]),

    at: (at) => valueAt(self, at) ?? 0,

    least: (from, to) => {
      let lowest: number | undefined;
      let covered = NOTHING;

      for (const span of resolve(self, { from, to })) {
        lowest =
          lowest === undefined ? span.value : Math.min(lowest, span.value);
        const length = duration(span);
        if (length !== undefined) {
          covered = covered.add(length);
        }
      }

      // Anything the layers left uncovered is nobody there, which is lower
      // than any figure they assigned. Comparing what was covered against the
      // window finds that without a second sweep for the gaps.
      const window = from.until(to, { largestUnit: "hour" });
      if (Temporal.Duration.compare(covered, window) < 0) {
        return 0;
      }
      return lowest ?? 0;
    },

    counts: (from, to) =>
      resolve(self, to === undefined ? { from } : { from, to }),
  };

  return self;
}

/**
 * An empty tally: nobody, until something says otherwise.
 *
 * ```ts
 * const staff = tally()
 *   .plus(weekdays(), 3)
 *   .plus(weekends(), 1)
 *   .plus("2026-03-11", 2)
 *   .exactly("2026-12-24", 1);
 * ```
 */
export function tally(): Tally {
  return build([]);
}
