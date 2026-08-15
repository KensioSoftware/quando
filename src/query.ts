/**
 * Asking a rule a question, rather than reading the times it covers.
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

import type { Context } from "./context.js";
import { duration, type Interval } from "./interval.js";
import { intervals } from "./interpret.js";
import type { Rule } from "./rule.js";
import { take } from "./stream.js";

/** Zero, as a duration to accumulate onto. */
const NOTHING = Temporal.Duration.from({ seconds: 0 });

/**
 * How far a search runs.
 *
 * With neither the context's `to` nor a `within`, a search is unbounded. That
 * is fine and often what you want — the first interval of a satisfiable rule
 * arrives immediately, however far the rule recurs. It is only a rule that
 * covers *nothing* that has no answer to give and no way to discover it, and
 * that case runs until stopped. Give a bound when the answer might be nothing.
 */
export interface Search {
  /** Look no further ahead than this from where the search starts. */
  readonly within?: Temporal.Duration;
}

function bounded(context: Context, search: Search | undefined): Context {
  const within = search?.within;
  if (within === undefined) {
    return context;
  }
  const horizon = context.from.add(within);
  return { ...context, to: horizon };
}

/**
 * Whether a rule covers an instant.
 *
 * Always terminates, whatever the rule and whatever the context: it asks about
 * the smallest window there is, so nothing can walk far looking for an answer.
 */
export function activeAt(
  rule: Rule,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): boolean {
  const moment: Context = {
    ...context,
    from: at,
    to: at.add({ nanoseconds: 1 }),
  };
  return take(intervals(rule, moment), 1).length > 0;
}

/**
 * How much time a rule covers within a window.
 *
 * Needs a window with an end, because the alternative is a number that never
 * finishes being counted.
 */
export function elapsed(rule: Rule, context: Context): Temporal.Duration {
  if (context.to === undefined) {
    throw new RangeError(
      "elapsed() needs a window with an end: give the context a `to`.",
    );
  }

  let total = NOTHING;
  for (const interval of intervals(rule, context)) {
    const length = duration(interval);
    if (length !== undefined) {
      total = total.add(length);
    }
  }
  return total.round({ largestUnit: "hour" });
}

/**
 * The next stretch of time a rule covers, at or after the context's start.
 *
 * `undefined` when there is none within the search. If the rule is covering
 * time already at the context's start, that stretch is returned clipped to
 * begin there — "when does it next open" answers "it is open" rather than
 * skipping to tomorrow.
 */
export function next(
  rule: Rule,
  context: Context,
  search?: Search,
): Interval | undefined {
  const [first] = take(intervals(rule, bounded(context, search)), 1);
  return first;
}

/**
 * Where you get to after an amount of time that only counts while a rule holds.
 *
 * Three operating hours from an order placed at five to five on a Friday is
 * some way into Monday morning, and this is the function that says where.
 * `undefined` when the search runs out before the time does.
 */
export function advanceBy(
  from: Temporal.ZonedDateTime,
  amount: Temporal.Duration,
  options: { readonly during: Rule } & Search & Omit<Context, "from" | "to">,
): Temporal.ZonedDateTime | undefined {
  if (Temporal.Duration.compare(amount, NOTHING) < 0) {
    throw new RangeError(
      `advanceBy() cannot go backwards. Asked for ${amount.toString()}.`,
    );
  }

  const { during, within, ...rest } = options;
  const context = bounded(
    { ...rest, from },
    within === undefined ? undefined : { within },
  );

  let remaining = amount;
  for (const interval of intervals(during, context)) {
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

  return undefined;
}
