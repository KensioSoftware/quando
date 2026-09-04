/**
 * Builders for the rules that bound a stretch of the calendar.
 *
 * All three write the same `dateRange` rule. They exist as three because
 * `onOrAfter("2026-04-01")` says what it means and a range with one end left
 * undefined does not.
 */

import { build, type Built } from "./built-rule.js";
import type { DateRangeRule } from "./rule.js";
import { asDate, asZone } from "./validation.js";

/** Every day from a date onwards, that day included. */
export function onOrAfter(date: string, zone?: string): Built<DateRangeRule> {
  return build(bounded(asDate(date, "date"), undefined, zone));
}

/** Every day up to a date, that day included. */
export function onOrBefore(date: string, zone?: string): Built<DateRangeRule> {
  return build(bounded(undefined, asDate(date, "date"), zone));
}

/** Every day from one date to another, both included. */
export function between(
  from: string,
  to: string,
  zone?: string,
): Built<DateRangeRule> {
  const start = asDate(from, "from");
  const end = asDate(to, "to");
  if (Temporal.PlainDate.compare(start, end) > 0) {
    throw new RangeError(
      `A date range must not end before it starts: "${from}" to "${to}".`,
    );
  }
  return build(bounded(start, end, zone));
}

/** Present or absent, never present-and-undefined. */
function bounded(
  from: string | undefined,
  to: string | undefined,
  zone: string | undefined,
): DateRangeRule {
  return {
    type: "dateRange",
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    ...(zone === undefined ? {} : { zone: asZone(zone, "zone") }),
  };
}
