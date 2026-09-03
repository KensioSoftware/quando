/**
 * The plain forms the domain layer accepts in place of rules.
 *
 * `"09:00-17:00"` stands for `timeOfDay("09:00", "17:00")`. `"2026-03-11"`
 * stands for `dates("2026-03-11")`. Rules are objects and these forms are
 * strings, which keeps the choice unambiguous. Both layers validate input when
 * the rule is built.
 */

import { dates, timeOfDay } from "./build.js";
import type { Rule } from "./rule.js";

/** A rule, a `"09:00-17:00"` window, or a whole day given as a date. */
export type PlainRule = Rule | string;

function badRange(range: string, problem: string): never {
  throw new RangeError(
    `"${range}" is not a range of times: ${problem}. ` +
      `Expected something like "09:00-17:00".`,
  );
}

/** A wall-clock window from `"09:00-17:00"`, or a rule left as it is. */
export function asHours(hours: PlainRule): Rule {
  if (typeof hours !== "string") {
    return hours;
  }

  const parts = hours.split("-");
  if (parts.length !== 2) {
    badRange(hours, `it has ${parts.length - 1} dashes rather than one`);
  }

  const [from = "", to = ""] = parts.map((part) => part.trim());
  for (const time of [from, to]) {
    try {
      Temporal.PlainTime.from(time);
    } catch {
      badRange(hours, `"${time}" is not a time of day`);
    }
  }

  return timeOfDay(from, to);
}

/** Whole days from `"2026-03-11"`, or a rule left as it is. */
export function asDays(scope: PlainRule): Rule {
  if (typeof scope !== "string") {
    return scope;
  }

  try {
    Temporal.PlainDate.from(scope);
  } catch {
    throw new RangeError(
      `"${scope}" is not a date. Expected something like "2026-03-11", ` +
        `or a rule such as weekdays().`,
    );
  }

  return dates(scope);
}
