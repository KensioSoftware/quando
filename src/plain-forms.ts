/**
 * The plain forms the domain layer accepts in place of rules.
 *
 * A string is read as a line of terms, so `"09:00-17:00"` is
 * `timeOfDayRange("09:00", "17:00")`, `"2026-03-11"` is `dates("2026-03-11")`, and
 * `"mon-fri 09:00-17:00"` is both of them together. Rules are objects and
 * these forms are strings, so the two are always told apart by their type.
 * Both layers validate input when the rule is built.
 *
 * The two names below say what the argument is for rather than what it will
 * accept. `setHours("2026-03-11", "09:00-17:00")` reads as the day and the
 * hours it names, and either side would take any term the notation has. See
 * [docs/terms](../docs/terms/README.md).
 */

import type { RuleData } from "./rule.js";
import { parseRuleExpression } from "./terms.js";

/** A rule, or a line of terms such as `"mon-fri 09:00-17:00"`. */
export type RuleInput = RuleData | string;

/** A wall-clock window from `"09:00-17:00"`, or a rule left as it is. */
export function asHours(hours: RuleInput): RuleData {
  return typeof hours === "string" ? parseRuleExpression(hours) : hours;
}

/** Whole days from `"2026-03-11"`, or a rule left as it is. */
export function asDays(scope: RuleInput): RuleData {
  return typeof scope === "string" ? parseRuleExpression(scope) : scope;
}
