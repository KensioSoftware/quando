/**
 * Reading the leaves of one term out as the values a recurrence part holds.
 *
 * Each of these takes a term and returns what it selects. They are separate
 * from the slotting in [rrule-export-terms.ts](./rrule-export-terms.ts) for
 * the ordinary reason: that file decides which part a term is, and these
 * decide what the part says.
 */

import { type Window, windowOf } from "./day-windows.js";
import type {
  CalendarRule,
  DaysOfMonthRule,
  DaysOfWeekRule,
  Month,
  MonthsOfYearRule,
  NthDayOfWeekInMonthRule,
  TimeOfDayRule,
  Weekday,
} from "./rule.js";
import type { Term } from "./rule-terms.js";

/** A weekday counted within the month, as `BYDAY` writes it. */
export interface NthDays {
  readonly nth: number;
  readonly days: readonly Weekday[];
}

/** What a `BYDAY` holds: bare weekdays, counted ones, or both together. */
export interface DaySelection {
  readonly weekdays: readonly Weekday[];
  readonly nths: readonly NthDays[];
}

/**
 * Whether a term's leaves all belong in `BYDAY`.
 *
 * The one part two kinds of leaf share, which is why a term holding both is a
 * single selection rather than a union of two.
 */
export function isByDay(kinds: ReadonlySet<CalendarRule["type"]>): boolean {
  return [...kinds].every(
    (kind) => kind === "daysOfWeek" || kind === "nthDayOfWeekInMonth",
  );
}

export function daySelection(term: Term): DaySelection {
  return {
    weekdays: term
      .filter((leaf): leaf is DaysOfWeekRule => leaf.type === "daysOfWeek")
      .flatMap((leaf) => [...leaf.days]),
    nths: term
      .filter(
        (leaf): leaf is NthDayOfWeekInMonthRule =>
          leaf.type === "nthDayOfWeekInMonth",
      )
      .map((leaf) => ({ nth: leaf.nth, days: leaf.days })),
  };
}

export function windowsIn(term: Term): Window[] {
  return term
    .filter((leaf): leaf is TimeOfDayRule => leaf.type === "timeOfDay")
    .map((leaf) => windowOf(leaf));
}

export function monthsIn(term: Term): Month[] {
  return term
    .filter((leaf): leaf is MonthsOfYearRule => leaf.type === "monthsOfYear")
    .flatMap((leaf) => [...leaf.months]);
}

export function daysOfMonthIn(term: Term): number[] {
  return term
    .filter((leaf): leaf is DaysOfMonthRule => leaf.type === "daysOfMonth")
    .flatMap((leaf) => [...leaf.days]);
}
