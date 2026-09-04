/**
 * A readable way to write a rule, which is also the rule.
 *
 * `weekdays().and(timeOfDay("09:00", "17:00"))` is the nested rule document
 * with non-enumerable methods attached. JSON and structured cloning see its
 * data fields only. A built rule already satisfies `Rule` and needs no
 * `.build()` step.
 */

import type {
  AllRule,
  AlwaysRule,
  AnyRule,
  InZoneRule,
  NeverRule,
  NotRule,
  Rule,
} from "./rule.js";
import { build, type Built } from "./built-rule.js";
import { asZone } from "./validation.js";

export { build, type Built } from "./built-rule.js";
export {
  dates,
  daysOfWeek,
  timeOfDay,
  weekdays,
  weekends,
} from "./calendar-rules.js";
export {
  daysOfMonth,
  monthsOfYear,
  nthDayOfWeekInMonth,
} from "./month-builders.js";

/** All of time. */
export function always(): Built<AlwaysRule> {
  return build({ type: "always" });
}

/** No time at all. */
export function never(): Built<NeverRule> {
  return build({ type: "never" });
}

/** Every one of these must hold. With none, all of time. */
export function all(...rules: readonly Rule[]): Built<AllRule> {
  return build({ type: "all", rules });
}

/** Any one of these. With none, no time at all. */
export function any(...rules: readonly Rule[]): Built<AnyRule> {
  return build({ type: "any", rules });
}

/** The times a rule does not cover. */
export function not(rule: Rule): Built<NotRule> {
  return build({ type: "not", rule });
}

/** Evaluates a rule subtree in a named time zone. */
export function inZone(zone: string, rule: Rule): Built<InZoneRule> {
  return build({ type: "inZone", zone: asZone(zone, "zone"), rule });
}
