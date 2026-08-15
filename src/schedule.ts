/**
 * Opening hours, in the words people use for them.
 *
 * Everything here is a cascade underneath, and a `Schedule` *is* one — the
 * same trick the rule builders use, so it serialises to the same document and
 * `resolve` reads it unchanged. What this adds is vocabulary: nobody running a
 * warehouse says "add a layer to the cascade", they say we are open weekdays,
 * closed on bank holidays, and on the eleventh we close at three.
 *
 * Those three read in the order they are said, and each one outranks what came
 * before it — which is the same precedence a cascade has, arrived at by
 * writing the sentence in the obvious order rather than by knowing the rule.
 */

import { all } from "./build.js";
import { type Cascade, type Layer, layer, replace } from "./cascade.js";
import type { Context } from "./context.js";
import { duration, type Interval } from "./interval.js";
import { asDays, asHours, type PlainRule } from "./plain-forms.js";
import { resolve } from "./resolve.js";
import { take } from "./stream.js";

/** Zero, as a duration to accumulate onto. */
const NOTHING = Temporal.Duration.from({ seconds: 0 });

/**
 * When something is open, and the questions worth asking about that.
 *
 * A `Schedule` is a `Cascade<boolean>`, so anything that takes a cascade takes
 * one of these. The methods below are the common half said plainly; the
 * cascade underneath is the whole of it.
 */
export interface Schedule extends Cascade<boolean> {
  /**
   * Open during these times. With hours, inside them on those days; without,
   * for the whole of them.
   */
  readonly open: (scope: PlainRule, hours?: PlainRule) => Schedule;

  /** Closed for the whole of these times, whatever was said before. */
  readonly closed: (scope: PlainRule) => Schedule;

  /**
   * On this day, these hours instead — not as well as.
   *
   * The usual hours do not show through the part this leaves out, which is
   * what "we close early on the eleventh" means and what makes it different
   * from being closed between three and five.
   */
  readonly on: (day: PlainRule, hours: PlainRule) => Schedule;

  /** Whether it is open at that moment. */
  readonly isOpen: (at: Temporal.ZonedDateTime) => boolean;

  /**
   * The next stretch it is open, at or after a moment, or `undefined` if there
   * is none within `within` of it.
   *
   * A schedule that is never open has no answer to give and no way to discover
   * that, so pass `within` when that is a possibility.
   */
  readonly opensNext: (
    at: Temporal.ZonedDateTime,
    within?: Temporal.Duration,
  ) => Interval | undefined;

  /** How long it is open between two moments. */
  readonly openBetween: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
  ) => Temporal.Duration;
}

function open(scope: PlainRule, hours: PlainRule | undefined): Layer<boolean> {
  const when = asDays(scope);
  return layer(hours === undefined ? when : all(when, asHours(hours)), true);
}

function build(layers: readonly Layer<boolean>[]): Schedule {
  const self: Schedule = {
    type: "cascade",
    layers,

    open: (scope, hours) => build([...layers, open(scope, hours)]),
    closed: (scope) => build([...layers, layer(asDays(scope), false)]),
    on: (day, hours) =>
      build([...layers, replace(asDays(day), asHours(hours))]),

    isOpen: (at) => {
      // The smallest window there is, so this terminates whatever the layers
      // say — the same trick `activeAt` uses on a rule.
      const moment: Context = { from: at, to: at.add({ nanoseconds: 1 }) };
      const [now] = take(resolve(self, moment), 1);
      return now?.value ?? false;
    },

    opensNext: (at, within) => {
      const search: Context =
        within === undefined ? { from: at } : { from: at, to: at.add(within) };

      for (const period of resolve(self, search)) {
        if (period.value) {
          return period;
        }
      }
      return;
    },

    openBetween: (from, to) => {
      let total = NOTHING;
      for (const period of resolve(self, { from, to })) {
        const length = period.value ? duration(period) : undefined;
        if (length !== undefined) {
          total = total.add(length);
        }
      }
      return total.round({ largestUnit: "hour" });
    },
  };

  return self;
}

/**
 * An empty schedule: open for nothing until something says otherwise.
 *
 * ```ts
 * const openingHours = schedule()
 *   .open(weekdays(), "09:00-17:00")
 *   .closed("2026-12-25")
 *   .on("2026-03-11", "09:00-15:00");
 * ```
 */
export function schedule(): Schedule {
  return build([]);
}
