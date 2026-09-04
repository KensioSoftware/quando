/**
 * Builders for the rules that select by month and by position in the month.
 *
 * The month half of the rule builders, sitting with the rest of the month
 * code: [month-rules.ts](./month-rules.ts) reads these as intervals and
 * [month-explanation-text.ts](./month-explanation-text.ts) puts them into
 * words. [calendar-rules.ts](./calendar-rules.ts) has the week, the dates and
 * the clock.
 */

import { build, type Built } from "./built-rule.js";
import type { DaysOfMonthRule, Month, MonthsOfYearRule } from "./rule.js";
import { asDayOfMonth, asMonth } from "./validation.js";

/** Whole days, by position in the month. Negative days count from the end. */
export function daysOfMonth(
  ...days: readonly number[]
): Built<DaysOfMonthRule> {
  return build({
    type: "daysOfMonth",
    days: days.map((day, index) => asDayOfMonth(day, `days[${index}]`)),
  });
}

/** Whole months, by name. */
export function monthsOfYear(
  ...months: readonly Month[]
): Built<MonthsOfYearRule> {
  return build({
    type: "monthsOfYear",
    months: months.map((month, index) => asMonth(month, `months[${index}]`)),
  });
}
