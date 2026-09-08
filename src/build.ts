/**
 * A readable way to write a rule, which is also the rule.
 *
 * `weekdays().and(timeOfDay("09:00", "17:00"))` is the nested rule document
 * with non-enumerable methods attached. JSON and structured cloning see its
 * data fields only. A built rule already satisfies `Rule` and needs no
 * `.build()` step.
 */

import { assertJsonValue, type JsonValue } from "./json.js";
import type {
  AllRule,
  AlwaysRule,
  AnyRule,
  CustomRule,
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
  monthCodes,
  monthsOfYear,
  nthDayOfWeekInMonth,
} from "./month-builders.js";
export type { EveryOptions } from "./every-builders.js";
export { every } from "./every-builders.js";
export { between, onOrAfter, onOrBefore } from "./range-builders.js";

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

/**
 * A rule type the application supplies, named here and implemented in the
 * registry a query carries on `context.rules`.
 *
 * ```ts
 * schedule().open(weekdays()).closed(custom("bank-holidays", { region: "gb" }));
 * ```
 *
 * The options are stored in the document, so they must survive a JSON round
 * trip. See [custom-rules.ts](./custom-rules.ts) for what a rule type is.
 */
export function custom(
  name: string,
  options?: JsonValue,
  zone?: string,
): Built<CustomRule> {
  if (name.length === 0) {
    throw new RangeError("A custom rule needs a name to look its type up by.");
  }
  if (options !== undefined) {
    assertJsonValue(options, "options");
  }
  return build({
    type: "custom",
    name,
    ...(options === undefined ? {} : { options }),
    ...(zone === undefined ? {} : { zone: asZone(zone, "zone") }),
  });
}

export { inCalendar, inZone } from "./scope-builders.js";
export {
  atMost,
  type AtMostOptions,
  atMostTime,
  spacedBy,
} from "./occurrence-builders.js";
