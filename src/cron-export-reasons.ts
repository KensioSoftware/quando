/**
 * Naming what stops a term that cron has no field for.
 *
 * Split from [cron-export-leaves.ts](./cron-export-leaves.ts), which reads the
 * terms that do have one. Each reason reads after "no cron expression,
 * because …", and names the field cron is missing rather than saying the rule
 * is unsupported.
 */

import type { CalendarRule } from "./rule.js";

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
    "monthCodes",
    "it names months by code, and cron's month field is Gregorian. Name Gregorian months with monthsOfYear",
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
