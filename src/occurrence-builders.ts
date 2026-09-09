/**
 * Building the rules that count what has already happened.
 *
 * One argument says which window a cap counts in, and its shape says which
 * kind. `atMost(4, "days")` is four a day, and the count starts again at
 * midnight. `atMost(4, "PT24H")` is four in any twenty-four hours, and the
 * oldest falls out the far end as time passes. The document keeps the two in
 * separate fields, where every reader of it sees the same thing.
 */

import { build, type Built } from "./built-rule.js";
import {
  type AtMostRule,
  type AtMostTimeRule,
  PERIODS,
  type SpacedByRule,
} from "./rule.js";
import { asCount, asExactGap, asGap } from "./occurrence-validation.js";
import { asPeriod, asZone } from "./validation.js";

/** Options for a cap. */
export interface AtMostOptions {
  readonly zone?: string;
}

/**
 * At most `count` occurrences in each window.
 *
 * `per` is a calendar period (`"days"`, `"weeks"`, `"months"`, `"years"`) for
 * buckets that reset, or an ISO duration (`"PT24H"`, `"P180D"`) for a rolling
 * window that does not.
 */
export function atMost(
  count: number,
  per: string,
  options: AtMostOptions = {},
): Built<AtMostRule> {
  const checked = asCount(count, "count");
  const zone =
    options.zone === undefined ? {} : { zone: asZone(options.zone, "zone") };

  return build(
    isPeriodWord(per)
      ? { type: "atMost", count: checked, per: asPeriod(per, "per"), ...zone }
      : { type: "atMost", count: checked, within: asGap(per, "per"), ...zone },
  );
}

function isPeriodWord(per: string): boolean {
  return PERIODS.some((period) => period === per);
}

/**
 * At most `total` time occupied in each window.
 *
 * The sibling of {@link atMost}, capping how long things went on rather than
 * how many there were. `atMostTime("P90D", "P180D")` is ninety days in any
 * rolling one hundred and eighty, and `atMostTime("PT56H", "weeks")` is
 * fifty-six hours a week.
 *
 * Both durations are exact time. Years, months and weeks are refused, and a
 * day is read as 24 hours. An occurrence with no `lasting` takes no time and
 * fills nothing.
 */
export function atMostTime(
  total: string,
  per: string,
  options: AtMostOptions = {},
): Built<AtMostTimeRule> {
  const checked = asExactGap(total, "total");
  const zone =
    options.zone === undefined ? {} : { zone: asZone(options.zone, "zone") };

  return build(
    isPeriodWord(per)
      ? {
          type: "atMostTime",
          total: checked,
          per: asPeriod(per, "per"),
          ...zone,
        }
      : {
          type: "atMostTime",
          total: checked,
          within: asExactGap(per, "per"),
          ...zone,
        },
  );
}

/**
 * Occurrences at least `gap` apart, written as an ISO duration.
 *
 * Measured from the end of one to the start of the next, and read both ways
 * round, so an instant too close before an occurrence is refused the same as
 * one too close after.
 */
export function spacedBy(gap: string): Built<SpacedByRule> {
  return build({ type: "spacedBy", gap: asGap(gap, "gap") });
}
