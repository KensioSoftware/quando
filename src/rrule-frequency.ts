/**
 * What a frequency means, and what it implies when nothing narrows it.
 *
 * `FREQ=WEEKLY` on its own repeats on the weekday the recurrence starts, and
 * `FREQ=MONTHLY` on its own repeats on its day of the month. RFC 5545 says
 * those defaults come from DTSTART, so they are worked out here rather than
 * left for a reader to notice their absence.
 */

import { fail } from "./parse-shape.js";
import type { Period } from "./rule.js";

const PERIOD_OF = new Map<string, Period>([
  ["DAILY", "days"],
  ["WEEKLY", "weeks"],
  ["MONTHLY", "months"],
  ["YEARLY", "years"],
]);

/**
 * Frequencies that recur faster than a day.
 *
 * `every` steps through calendar periods, and there is no sub-daily one for
 * these to become. Named apart from an unknown frequency, because they are
 * real and Quando simply has nothing to map them onto.
 */
const SUB_DAILY = new Set(["SECONDLY", "MINUTELY", "HOURLY"]);

export function periodOf(freq: string): Period {
  const named = freq.toUpperCase();
  if (SUB_DAILY.has(named)) {
    return fail(
      "FREQ",
      `${named} recurs faster than a day, and a rule steps through calendar periods`,
    );
  }
  const period = PERIOD_OF.get(named);
  return (
    period ??
    fail(
      "FREQ",
      `"${freq}" is not a frequency. Expected one of ${[...PERIOD_OF.keys()].join(", ")}`,
    )
  );
}

/** Which parts a frequency fills in for itself when nothing else does. */
export interface Implied {
  readonly weekday: boolean;
  readonly dayOfMonth: boolean;
  readonly month: boolean;
}

export function impliedBy(
  period: Period,
  has: { day: boolean; dayOfMonth: boolean; month: boolean },
): Implied {
  if (period === "weeks") {
    return { weekday: !has.day, dayOfMonth: false, month: false };
  }
  if (period === "months") {
    return {
      weekday: false,
      dayOfMonth: !has.day && !has.dayOfMonth,
      month: false,
    };
  }
  if (period === "years") {
    return {
      weekday: false,
      dayOfMonth: !has.day && !has.dayOfMonth,
      month: !has.day && !has.dayOfMonth && !has.month,
    };
  }
  // Daily recurs on every day, so there is nothing left to narrow it with.
  return { weekday: false, dayOfMonth: false, month: false };
}
