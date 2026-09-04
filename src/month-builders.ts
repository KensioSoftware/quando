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
import type {
  DaysOfMonthRule,
  Month,
  MonthsOfYearRule,
  NthDayOfWeekInMonthRule,
  Weekday,
} from "./rule.js";
import {
  asDayOfMonth,
  asMonth,
  asNthOfMonth,
  asWeekday,
} from "./validation.js";

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

/**
 * Whole days, by which occurrence of their weekday they are in the month.
 *
 * `nthDayOfWeekInMonth(1, "monday")` is the first Monday of every month, and
 * `nthDayOfWeekInMonth(-1, "friday")` is the last Friday. Negative counts from the
 * end, so the last one is the last whether the month holds four or five.
 */
export function nthDayOfWeekInMonth(
  nth: number,
  ...days: readonly Weekday[]
): Built<NthDayOfWeekInMonthRule> {
  return build({
    type: "nthDayOfWeekInMonth",
    nth: asNthOfMonth(nth, "nth"),
    days: days.map((day, index) => asWeekday(day, `days[${index}]`)),
  });
}
