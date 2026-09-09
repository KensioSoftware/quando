import type { QueryArrival } from "./query-arrival.js";
import { dayArrival } from "./day-arrival.js";
import { refuse, unknownIn } from "./horizon-guard.js";
import { requireWindowEnd } from "./context.js";
/**
 * Counting whole days, where [query.ts](./query.ts) counts elapsed time.
 *
 * "Three working days" is not three multiples of some length of day. It counts
 * the days on which work happens, and a day open from nine until one is one of
 * them exactly as a day open from nine until five is. `addCoveredTime` refuses `P3D`
 * because a duration in days is ambiguous. A count of days is exact. It is a
 * different operation and it lives here.
 *
 * A **covered day** is a local calendar date on which the input covers any time
 * at all. Dates belong to a zone (the context's, or a schedule's own). A count
 * is a count of dates on one wall calendar.
 */

import type { CoverageSource } from "./assigned.js";
import type { Context, QueryWindow } from "./context.js";
import { coveredDays } from "./day-walk.js";
import type { Estimate } from "./estimate.js";
import { resolvedOutcomes } from "./estimate-query.js";
import type { Search } from "./search.js";

/**
 * Whether the date a count starts on can itself be counted.
 *
 * `"excluded"` counts the covered dates after the starting date, the "not
 * counting the day of the act" rule that deadlines and delivery promises use.
 * `"included"` counts the starting date first, when covered time remains on it
 * at or after the starting instant.
 */
export type StartingDay = "excluded" | "included";

/** What {@link addCoveredDays} reads, and how far it looks for an answer. */
export interface CoveredDayOptions<V>
  extends Pick<Search, "within">, Omit<Context, "from" | "to"> {
  /** The rule, schedule or selected cascade value whose days are counted. */
  readonly during: CoverageSource<V>;

  /** Whether the starting date counts. `"excluded"` by default. */
  readonly startingDay?: StartingDay;
}

/**
 * How many local dates within a window carry any covered time.
 *
 * ```ts
 * coveredDayCount(openingHours, { from: monday, to: nextMonday }); // 5
 * ```
 *
 * The window is half open like every other one. A day whose covered time begins
 * exactly at `to` falls outside. Dates are read in the zone of `context.from`.
 * A day covered for five minutes counts the same as a day covered for eight
 * hours.
 */
export function coveredDayCount<V>(
  covers: CoverageSource<V>,
  context: QueryWindow,
): number {
  requireWindowEnd(
    context,
    "coveredDayCount() needs a window with an end: give the context a `to`.",
  );
  const fog = unknownIn(covers, context);
  if (fog !== undefined) {
    refuse("coveredDayCount()", fog, context);
  }
  return [...coveredDays(covers, context)].length;
}

/**
 * Where you get to after a number of whole days on which something is covered.
 *
 * ```ts
 * addCoveredDays(ordered, 3, { during: openingHours });
 * ```
 *
 * Three working days from a Friday afternoon is Wednesday, and this is the
 * function that says so. The answer is the first instant at or after `from`
 * that the input covers on the date the count lands. For opening hours that is
 * when the doors open that morning. `undefined` when a bounded search runs out
 * before the days do, and {@link SearchLimitExceededError} when an unbounded
 * one exhausts its automatic limit.
 *
 * The starting date is skipped unless `startingDay` asks for it. Counting runs
 * forward only, and a zero count returns the starting instant. Asked during
 * covered time with `startingDay: "included"`, a count of one answers with
 * `from`.
 */
export function addCoveredDays<V, A extends number | Estimate<number>>(
  from: Temporal.ZonedDateTime,
  count: A,
  options: CoveredDayOptions<V>,
): QueryArrival<A> {
  const arrival =
    typeof count === "number"
      ? dayArrival(from, count, options)
      : resolvedOutcomes(
          count,
          "addCoveredDays()",
          (days) => dayArrival(from, days, options),
          options.within,
        );
  return arrival as QueryArrival<A>;
}
