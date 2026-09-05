/**
 * Reading the leaves of one term out as the values a cron field holds, and
 * naming what stops a term that has no field at all.
 *
 * The reasons live here beside the reading because they are the same subject
 * from the other side: what a term selects, and what cron has no way to say.
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

const NO_FIELD = new Map([
  [
    "every",
    "it steps through a cycle of periods counted from a date, and cron only repeats within a month, a week and a day",
  ],
  ["dates", "it names calendar dates, and cron has no year field"],
  [
    "dateRange",
    "it is bounded to a stretch of the calendar, and cron has no year field",
  ],
  [
    "nthDayOfWeekInMonth",
    "it counts a weekday within the month, which POSIX cron cannot say. The `#` operator that can is a Quartz extension",
  ],
]);

/** What stops a term that is not one field, named as specifically as it can be. */
export function reasonFor(kinds: ReadonlySet<CalendarRule["type"]>): string {
  for (const kind of kinds) {
    const problem = NO_FIELD.get(kind);
    if (problem !== undefined) {
      return problem;
    }
  }
  return `it unions ${[...kinds].join(" with ")}, and cron's only union is between its two day fields`;
}
