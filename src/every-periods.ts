/**
 * Counting calendar periods between two dates.
 *
 * The arithmetic behind `every`, in one place because two callers need the
 * same answer: the evaluator deciding whether a day is covered, and the
 * explanation saying which cycle a day is in. Two copies would be two things
 * to keep in step.
 *
 * Weeks are seven-day blocks measured from the anchor day, so a rule anchored
 * on a Wednesday has weeks running Wednesday to Wednesday. Months and years
 * are counted on the calendar, so the answer never depends on how many days
 * the months in between held.
 */

import type { Period } from "./rule.js";

const DAYS_IN_A_WEEK = 7;
const MONTHS_IN_A_YEAR = 12;

/** How many whole periods a date is past the anchor. Negative before it. */
export function periodsBetween(
  anchor: Temporal.PlainDate,
  date: Temporal.PlainDate,
  period: Period,
): number {
  if (period === "years") {
    return date.year - anchor.year;
  }
  if (period === "months") {
    return (
      (date.year - anchor.year) * MONTHS_IN_A_YEAR + (date.month - anchor.month)
    );
  }

  const days = anchor.until(date, { largestUnit: "day" }).days;
  return period === "days" ? days : Math.floor(days / DAYS_IN_A_WEEK);
}

/**
 * Whether a period index is one the rule selects.
 *
 * The remainder is lifted back into range first, because a date before the
 * anchor gives a negative index and JavaScript's `%` keeps the sign. Without
 * that, every period before the anchor would miss.
 */
export function onCycle(periods: number, interval: number): boolean {
  return ((periods % interval) + interval) % interval === 0;
}
