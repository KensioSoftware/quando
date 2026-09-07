/**
 * Counting whole days, where [query.ts](./query.ts) counts elapsed time.
 *
 * "Three working days" is not three multiples of some length of day. It counts
 * the days on which work happens, and a day open from nine until one is one of
 * them exactly as a day open from nine until five is. `advanceBy` refuses `P3D`
 * because a duration in days is ambiguous. A count of days is exact. It is a
 * different operation and it lives here.
 *
 * A **covered day** is a local calendar date on which the input covers any time
 * at all. Dates belong to a zone (the context's, or a schedule's own). A count
 * is a count of dates on one wall calendar.
 */

import type { Covers } from "./assigned.js";
import type { Context } from "./context.js";
import { coveredDays } from "./day-walk.js";
import {
  boundSearch,
  SearchLimitExceededError,
  type Search,
} from "./search.js";

/**
 * Whether the date a count starts on can itself be counted.
 *
 * `"excluded"` counts the covered dates after the starting date, the "not
 * counting the day of the act" rule that deadlines and delivery promises use.
 * `"included"` counts the starting date first, when covered time remains on it
 * at or after the starting instant.
 */
export type StartingDay = "excluded" | "included";

/** What {@link advanceByCoveredDays} reads, and how far it looks for an answer. */
export interface CoveredDayOptions<V>
  extends Pick<Search, "within">, Omit<Context, "from" | "to"> {
  /** The rule, schedule or selected cascade value whose days are counted. */
  readonly during: Covers<V>;

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
  covers: Covers<V>,
  context: Context,
): number {
  if (context.to === undefined) {
    throw new RangeError(
      "coveredDayCount() needs a window with an end: give the context a `to`.",
    );
  }
  return [...coveredDays(covers, context)].length;
}

/**
 * Where you get to after a number of whole days on which something is covered.
 *
 * ```ts
 * advanceByCoveredDays(ordered, 3, { during: openingHours });
 * ```
 *
 * Three working days from a Friday afternoon is Wednesday, and this is the
 * function that says so. The answer is the first instant on that date the input
 * covers. That is when the doors open on the day the count lands. `undefined`
 * when the search runs out before the days do.
 *
 * The starting date is skipped unless `startingDay` asks for it. Counting runs
 * forward only, and a zero count returns the starting instant.
 */
export function advanceByCoveredDays<V>(
  from: Temporal.ZonedDateTime,
  count: number,
  options: CoveredDayOptions<V>,
): Temporal.ZonedDateTime | undefined {
  checkDayCount(count);
  if (count === 0) {
    return from;
  }

  const { during, within, startingDay = "excluded", ...rest } = options;
  const search = boundSearch(
    { ...rest, from },
    within === undefined ? undefined : { within },
  );
  const startDate = from.toPlainDate();

  let counted = 0;
  for (const day of coveredDays(during, search.context)) {
    if (startingDay === "excluded" && day.date.equals(startDate)) {
      continue;
    }
    counted += 1;
    if (counted === count) {
      return day.opensAt;
    }
  }

  if (search.automaticLimit !== undefined) {
    throw new SearchLimitExceededError(
      "advanceByCoveredDays()",
      search.automaticLimit,
    );
  }
  return undefined;
}

/** Rejects a count that is not a whole number of days forward. */
function checkDayCount(count: number): void {
  if (!Number.isInteger(count)) {
    throw new RangeError(
      `advanceByCoveredDays() counts whole days. Asked for ${count}. ` +
        "Part of a covered day is an elapsed duration, which advanceBy() takes.",
    );
  }
  if (count < 0) {
    throw new RangeError(
      `advanceByCoveredDays() cannot go backwards. Asked for ${count} days.`,
    );
  }
}
