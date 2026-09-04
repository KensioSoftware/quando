/**
 * Describing a month and a day-of-month match in words.
 *
 * Split from [calendar-explanation-text.ts](./calendar-explanation-text.ts)
 * because ordinals are their own small problem: `the 31st`, `the last day`,
 * `the 2nd-last day`, and the three numbers whose suffix the last digit gets
 * wrong.
 */

import { join, title } from "./explanation-phrases.js";
import { MONTHS, type Month } from "./rule.js";

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
