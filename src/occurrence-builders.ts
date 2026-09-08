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
import { type AtMostRule, PERIODS, type SpacedByRule } from "./rule.js";
import { asCount, asGap } from "./occurrence-validation.js";
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
 * Occurrences at least `gap` apart, written as an ISO duration.
 *
 * Measured from the end of one to the start of the next, and read both ways
 * round, so an instant too close before an occurrence is refused the same as
 * one too close after.
 */
export function spacedBy(gap: string): Built<SpacedByRule> {
  return build({ type: "spacedBy", gap: asGap(gap, "gap") });
}
