/**
 * Asking a question, rather than reading the times something covers.
 *
 * `intervals` is the plumbing. These are what a caller actually wants: is it
 * open now, how much working time is in this window, when does it next open,
 * and — the one both of the libraries this evolves from were built around —
 * where do you get to after three hours that only count while it is open.
 *
 * Durations are exact elapsed time throughout. Three operating hours means
 * three real hours of opening, so a window spanning a clock change is measured
 * by how long it lasted rather than by what the clock said.
 */

import { type Covers, covered } from "./assigned.js";
import type { Context } from "./context.js";
import { duration, type Interval } from "./interval.js";
import { checkExactDuration } from "./query-validation.js";
import {
  boundSearch,
  restartSearch,
  SearchLimitExceededError,
  type Search,
} from "./search.js";
import { take } from "./stream.js";

export {
  DEFAULT_SEARCH_LIMIT,
  SearchLimitExceededError,
  type Search,
} from "./search.js";

/** Zero, as a duration to accumulate onto. */
const NOTHING = Temporal.Duration.from({ seconds: 0 });

/**
 * Whether a rule, or a value a cascade assigns, covers an instant.
 *
 * Always terminates, whatever it is reading and whatever the context: it asks
 * about the smallest window there is, so nothing can walk far looking for an
 * answer.
 */
export function activeAt<V>(
  covers: Covers<V>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): boolean {
  const moment: Context = {
    ...context,
    from: at,
    to: at.add({ nanoseconds: 1 }),
  };
  return take(covered(covers, moment), 1).length > 0;
}

/**
 * How much time a rule, or a value a cascade assigns, covers within a window.
 *
 * Needs a window with an end, because the alternative is a number that never
 * finishes being counted.
 */
export function coveredDuration<V>(
  covers: Covers<V>,
  context: Context,
): Temporal.Duration {
  if (context.to === undefined) {
    throw new RangeError(
      "coveredDuration() needs a window with an end: give the context a `to`.",
    );
  }

  let total = NOTHING;
  for (const interval of covered(covers, context)) {
    const length = duration(interval);
    if (length !== undefined) {
      total = total.add(length);
    }
  }
  return total.round({ largestUnit: "hour" });
}

/**
 * The next stretch of time covered, at or after the context's start.
 *
 * `undefined` when there is none within the search. If time is being covered
 * already at the context's start, that stretch is returned clipped to begin
 * there — "when does it next open" answers "it is open" rather than skipping
 * to tomorrow.
 */
export function nextCoveredInterval<V>(
  covers: Covers<V>,
  context: Context,
  search?: Search,
): Interval | undefined {
  const window = boundSearch(context, search);
  const [first] = take(covered(covers, window.context), 1);
  if (first === undefined) {
    if (window.automaticLimit !== undefined) {
      throw new SearchLimitExceededError(
        "nextCoveredInterval()",
        window.automaticLimit,
      );
    }
    return;
  }
  if (search?.complete !== true || first.start === undefined) {
    return first;
  }
  const [whole] = take(covered(covers, restartSearch(context, first.start)), 1);
  return whole ?? first;
}

/**
 * Where you get to after an amount of time that only counts while something
 * holds.
 *
 * Three operating hours from an order placed at five to five on a Friday is
 * some way into Monday morning, and this is the function that says where.
 * `undefined` when the search runs out before the time does.
 */
export function advanceBy<V>(
  from: Temporal.ZonedDateTime,
  amount: Temporal.Duration,
  options: { readonly during: Covers<V> } & Search &
    Omit<Context, "from" | "to">,
): Temporal.ZonedDateTime | undefined {
  checkExactDuration(amount);
  if (Temporal.Duration.compare(amount, NOTHING) < 0) {
    throw new RangeError(
      `advanceBy() cannot go backwards. Asked for ${amount.toString()}.`,
    );
  }
  if (Temporal.Duration.compare(amount, NOTHING) === 0) {
    return from;
  }

  const { during, within, complete: _complete, ...rest } = options;
  const window = boundSearch(
    { ...rest, from },
    within === undefined ? undefined : { within },
  );

  let remaining = amount;
  for (const interval of covered(during, window.context)) {
    const length = duration(interval);

    // An interval with no end has more than enough of whatever is left.
    if (
      length === undefined ||
      Temporal.Duration.compare(length, remaining) >= 0
    ) {
      return interval.start?.add(remaining);
    }

    remaining = remaining.subtract(length);
  }

  if (window.automaticLimit !== undefined) {
    throw new SearchLimitExceededError("advanceBy()", window.automaticLimit);
  }
  return undefined;
}
