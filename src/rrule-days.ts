/**
 * The rule a recurrence's day parts come to.
 *
 * `BYDAY` carries two different ideas in one part. Bare weekday codes select
 * days of the week, and codes with an ordinal select the nth of that weekday
 * in the month. A recurrence may use both at once, and the union is what it
 * means.
 */

import { any } from "./build.js";
import { daysOfWeek } from "./calendar-rules.js";
import { nthDayOfWeekInMonth } from "./month-builders.js";
import { fail } from "./parse-shape.js";
import type { Period, Rule } from "./rule.js";
import type { ByDay } from "./rrule-values.js";

/**
 * `monthRestricted` says whether a `BYMONTH` narrows the recurrence.
 *
 * It is what makes an ordinal work under `FREQ=YEARLY`. `BYDAY=4TH` on its own
 * counts Thursdays through the whole year, which has no rule to map onto, but
 * with `BYMONTH=11` it counts them within November and
 * `nthDayOfWeekInMonth` says exactly that. Thanksgiving is written that way,
 * and so is most of what `FREQ=YEARLY` is used for.
 */
export function byDayRule(
  entries: readonly ByDay[],
  period: Period,
  monthRestricted: boolean,
): Rule {
  // Flattened rather than filtered, so the ordinal is a number from here on
  // and there is no absent one to fall back from.
  const counted = entries.flatMap((entry) =>
    entry.ordinal === undefined
      ? []
      : [{ day: entry.day, ordinal: entry.ordinal }],
  );
  if (counted.length > 0 && !countable(period, monthRestricted)) {
    return fail(
      "BYDAY",
      period === "years"
        ? "an ordinal under FREQ=YEARLY counts a weekday within the whole year, which has no rule to map onto. Add BYMONTH to count it within a month"
        : "an ordinal counts a weekday within a month, so it needs FREQ=MONTHLY or FREQ=YEARLY with BYMONTH",
    );
  }

  const plain = entries.filter((entry) => entry.ordinal === undefined);

  const rules: Rule[] = counted.map((entry) =>
    nthDayOfWeekInMonth(entry.ordinal, entry.day),
  );
  if (plain.length > 0) {
    rules.push(daysOfWeek(...plain.map((entry) => entry.day)));
  }

  const only = rules.length === 1 ? rules[0] : undefined;
  return only ?? any(...rules);
}

/** Where an ordinal has a month to count within. */
function countable(period: Period, monthRestricted: boolean): boolean {
  return period === "months" || (period === "years" && monthRestricted);
}
