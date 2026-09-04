/**
 * Builders for the rules that bound a stretch of the calendar.
 *
 * All three write a `dateRange` rule. They exist as three because
 * `onOrAfter("2026-04-01")` says what it means and a range with one end left
 * undefined does not. The type carries at least one bound, so each builder
 * writes the shape it fills rather than spreading optional fields together.
 */

import { build, type Built } from "./built-rule.js";
import type { DateRangeRule } from "./rule.js";
import { asDate, asZone } from "./validation.js";

/** Every day from a date onwards, that day included. */
export function onOrAfter(date: string, zone?: string): Built<DateRangeRule> {
  const from = asDate(date, "date");
  return build(
    zone === undefined
      ? { type: "dateRange", from }
      : { type: "dateRange", from, zone: asZone(zone, "zone") },
  );
}

/** Every day up to a date, that day included. */
export function onOrBefore(date: string, zone?: string): Built<DateRangeRule> {
  const to = asDate(date, "date");
  return build(
    zone === undefined
      ? { type: "dateRange", to }
      : { type: "dateRange", to, zone: asZone(zone, "zone") },
  );
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
  return build(
    zone === undefined
      ? { type: "dateRange", from: start, to: end }
      : {
          type: "dateRange",
          from: start,
          to: end,
          zone: asZone(zone, "zone"),
        },
  );
}
