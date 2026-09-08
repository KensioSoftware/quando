/**
 * The builders that say how a subtree is read rather than what it covers.
 *
 * A zone and a calendar are both scope. Each changes what the rules inside it
 * read off a date while leaving the times covered to them. That is why both
 * wrap a subtree instead of sitting beside one.
 */

import { build, type Built } from "./built-rule.js";
import type { InCalendarRule, InZoneRule, Rule } from "./rule.js";
import { asCalendar, asZone } from "./validation.js";

/** Evaluates a rule subtree in a named time zone. */
export function inZone(zone: string, rule: Rule): Built<InZoneRule> {
  return build({ type: "inZone", zone: asZone(zone, "zone"), rule });
}

/**
 * Evaluates a rule subtree on a named calendar.
 *
 * ```ts
 * inCalendar("hebrew", daysOfMonth(1)); // Rosh Chodesh
 * ```
 *
 * Any calendar `Temporal` implements. The instants do not move. What changes
 * is the year, month and day a rule reads off a date.
 */
export function inCalendar(
  calendar: string,
  rule: Rule,
): Built<InCalendarRule> {
  return build({
    type: "inCalendar",
    calendar: asCalendar(calendar, "calendar"),
    rule,
  });
}
