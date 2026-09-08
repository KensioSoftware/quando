/**
 * Counting words for the descriptions that need them.
 *
 * Ordinals are their own small problem: `the 31st`, `the last day`, `the
 * 2nd-last day`, and the three numbers whose suffix the last digit gets wrong.
 */

/** `2nd`, or `last` and `2nd-last` when counted from the end. */
export function nthName(nth: number): string {
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

/** `1st`, `2nd`, `3rd`, `4th`. */
export function ordinal(value: number): string {
  const teen = value % 100;
  // 11th, 12th and 13th break the pattern the last digit otherwise sets.
  const suffix =
    teen >= 11 && teen <= 13
      ? "th"
      : (ORDINAL_SUFFIXES.get(value % 10) ?? "th");
  return `${value}${suffix}`;
}

/** A day of the month as the rule names it, counting from either end. */
export function nameMonthDay(day: number): string {
  if (day > 0) {
    return `the ${ordinal(day)}`;
  }
  return day === -1 ? "the last day" : `the ${ordinal(-day)}-last day`;
}
