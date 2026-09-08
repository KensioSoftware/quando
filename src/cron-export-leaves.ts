/**
 * Reading the leaves of one term out as the values a cron field holds.
 *
 * What stops a term that has no field at all is the same subject from the
 * other side, and lives in
 * [cron-export-reasons.ts](./cron-export-reasons.ts).
 */

import { minutesOf, windowOf } from "./day-windows.js";
import type {
  CalendarRule,
  DaysOfMonthRule,
  DaysOfWeekRule,
  Month,
  MonthsOfYearRule,
  TimeOfDayRule,
  Weekday,
} from "./rule.js";
import type { Term } from "./rule-terms.js";

/** Whether a term's leaves all belong in one of the two day fields. */
export function isDayTerm(kinds: ReadonlySet<CalendarRule["type"]>): boolean {
  return [...kinds].every(
    (kind) => kind === "daysOfMonth" || kind === "daysOfWeek",
  );
}

/** What the two day fields select, either of which may be empty. */
export interface DaySelection {
  readonly ofMonth: readonly number[];
  readonly ofWeek: readonly Weekday[];
}

export function daysIn(term: Term): DaySelection {
  return {
    ofMonth: term
      .filter((leaf): leaf is DaysOfMonthRule => leaf.type === "daysOfMonth")
      .flatMap((leaf) => [...leaf.days]),
    ofWeek: term
      .filter((leaf): leaf is DaysOfWeekRule => leaf.type === "daysOfWeek")
      .flatMap((leaf) => [...leaf.days]),
  };
}

export function minutesIn(term: Term): number[] {
  return minutesOf(
    term
      .filter((leaf): leaf is TimeOfDayRule => leaf.type === "timeOfDay")
      .map((leaf) => windowOf(leaf)),
  );
}

export function monthsIn(term: Term): Month[] {
  return term
    .filter((leaf): leaf is MonthsOfYearRule => leaf.type === "monthsOfYear")
    .flatMap((leaf) => [...leaf.months]);
}
