/**
 * Describing a month and a day-of-month match in words.
 *
 * Split from [calendar-explanation-text.ts](./calendar-explanation-text.ts)
 * because ordinals are their own small problem: `the 31st`, `the last day`,
 * `the 2nd-last day`, and the three numbers whose suffix the last digit gets
 * wrong.
 */

import { join, title } from "./explanation-phrases.js";
import { MONTHS, type Month, WEEKDAYS, type Weekday } from "./rule.js";

/**
 * Describes a day-of-month match in calendar terms.
 *
 * Phrased as matching rather than being, because a day selected from the end
 * of the month has no reading where "the 31st is the last day" is a sentence
 * about anything but March.
 */
export function describeMonthDay(
  days: readonly number[],
  at: Temporal.ZonedDateTime,
  matched: boolean,
): string {
  if (days.length === 0) {
    return "No days of the month are listed.";
  }
  const today = ordinal(at.toPlainDate().day);
  const verb = matched ? "matches" : "does not match";
  const only = days.length === 1 ? days[0] : undefined;
  if (only !== undefined) {
    return `The ${today} ${verb} ${nameMonthDay(only)}.`;
  }
  const choices =
    days.length <= 3
      ? join(days.map((day) => nameMonthDay(day)))
      : `${days.length} listed days of the month`;
  return `The ${today} ${verb} one of ${choices}.`;
}

/** Describes a month match in calendar terms. */
export function describeMonth(
  months: readonly Month[],
  at: Temporal.ZonedDateTime,
): string {
  const month = MONTHS[at.month - 1] ?? "january";
  const name = title(month);
  const matched = months.includes(month);
  if (months.length === 0) {
    return "No months are listed.";
  }
  const only = months.length === 1 ? months[0] : undefined;
  if (only !== undefined) {
    return `${name} ${matched ? "is" : "is not"} ${title(only)}.`;
  }
  return `${name} ${matched ? "is" : "is not"} included in ${join(months.map((value) => title(value)))}.`;
}

/**
 * Describes which occurrence of a weekday a date is.
 *
 * The count is the fact the reader cannot see from the date, and it is the
 * whole reason the rule matched or did not. A date on the wrong weekday has no
 * count worth giving, so the weekday alone settles that one.
 */
export function describeNthDayOfWeekInMonth(
  nth: number,
  days: readonly Weekday[],
  at: Temporal.ZonedDateTime,
  matched: boolean,
): string {
  if (days.length === 0) {
    return "No weekdays are listed.";
  }

  const day = WEEKDAYS[at.dayOfWeek - 1] ?? "monday";
  if (!days.includes(day)) {
    return `${title(day)} is not ${join(days.map((value) => title(value)))}.`;
  }

  const date = at.toPlainDate();
  const count =
    nth > 0
      ? Math.ceil(date.day / 7)
      : Math.ceil((date.daysInMonth - date.day + 1) / 7);
  const here = `This is the ${nthName(nth > 0 ? count : -count)} ${title(day)} of the month`;

  return matched
    ? `${here}.`
    : `${here}, and the rule wants the ${nthName(nth)}.`;
}

/** `2nd`, or `last` and `2nd-last` when counted from the end. */
function nthName(nth: number): string {
  if (nth > 0) {
    return ordinal(nth);
  }
  return nth === -1 ? "last" : `${ordinal(-nth)}-last`;
}

const ORDINAL_SUFFIXES = new Map([
  [1, "st"],
  [2, "nd"],
  [3, "rd"],
]);

function ordinal(value: number): string {
  const teen = value % 100;
  // 11th, 12th and 13th break the pattern the last digit otherwise sets.
  const suffix =
    teen >= 11 && teen <= 13
      ? "th"
      : (ORDINAL_SUFFIXES.get(value % 10) ?? "th");
  return `${value}${suffix}`;
}

function nameMonthDay(day: number): string {
  if (day > 0) {
    return `the ${ordinal(day)}`;
  }
  return day === -1 ? "the last day" : `the ${ordinal(-day)}-last day`;
}
