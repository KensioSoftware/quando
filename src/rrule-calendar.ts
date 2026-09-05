/**
 * The day, month and weekday parts of a recurrence.
 *
 * Also what the frequency fills in when none of them is there. A weekly
 * recurrence naming no day repeats on the day it started, and a monthly one
 * repeats on its date. RFC 5545 takes both from DTSTART, so both are worked
 * out here rather than left missing.
 */

import { daysOfWeek } from "./build.js";
import { daysOfMonth, monthsOfYear } from "./month-builders.js";
import { MONTHS, type Period, type Rule, WEEKDAYS } from "./rule.js";
import { fail } from "./parse-shape.js";
import { byDayRule } from "./rrule-days.js";
import { impliedBy } from "./rrule-frequency.js";
import { parseByDay, partNumbers } from "./rrule-values.js";

export /**
 * The day, month and weekday parts, with what the frequency implies.
 *
 * A weekly recurrence naming no day repeats on the day it started, and a
 * monthly one repeats on its date. RFC 5545 takes both from DTSTART.
 */
function calendarRules(
  parts: Map<string, string>,
  period: Period,
  start: Temporal.PlainDate,
): Rule[] {
  const byDay = parts.has("BYDAY")
    ? parseByDay(parts.get("BYDAY") ?? "")
    : undefined;
  const byMonthDay = partNumbers(parts, "BYMONTHDAY", -31, 31);
  const byMonth = partNumbers(parts, "BYMONTH", 1, 12);

  const implied = impliedBy(period, {
    day: byDay !== undefined,
    dayOfMonth: byMonthDay !== undefined,
    month: byMonth !== undefined,
  });

  if (byMonthDay !== undefined && period === "weeks") {
    // RFC 5545 forbids the pair, and the reason is that a week has no day of
    // the month to select. Refused rather than intersected into something the
    // recurrence never meant.
    return fail("BYMONTHDAY", "has no meaning under FREQ=WEEKLY");
  }

  const rules: Rule[] = [];
  if (byDay !== undefined) {
    rules.push(byDayRule(byDay, period, byMonth !== undefined));
  } else if (implied.weekday) {
    // Filtered rather than indexed, so there is no miss to fall back from.
    rules.push(
      daysOfWeek(...WEEKDAYS.filter((_, i) => i + 1 === start.dayOfWeek)),
    );
  }

  if (byMonthDay !== undefined) {
    rules.push(daysOfMonth(...byMonthDay));
  } else if (implied.dayOfMonth) {
    rules.push(daysOfMonth(start.day));
  }

  if (byMonth !== undefined) {
    rules.push(
      monthsOfYear(...MONTHS.filter((_, i) => byMonth.includes(i + 1))),
    );
  } else if (implied.month) {
    rules.push(monthsOfYear(...MONTHS.filter((_, i) => i + 1 === start.month)));
  }
  return rules;
}
