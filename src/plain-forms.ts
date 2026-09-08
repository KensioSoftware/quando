/**
 * The plain forms the domain layer accepts in place of rules.
 *
 * A string is read as a line of terms, so `"09:00-17:00"` is
 * `timeOfDay("09:00", "17:00")`, `"2026-03-11"` is `dates("2026-03-11")`, and
 * `"mon-fri 09:00-17:00"` is both of them together. Rules are objects and
 * these forms are strings, so the two are always told apart by their type.
 * Both layers validate input when the rule is built.
 *
 * The two names below say what the argument is for rather than what it will
 * accept. `hoursOn("2026-03-11", "09:00-17:00")` reads as the day and the
 * hours it names, and either side would take any term the notation has. See
 * [docs/terms](../docs/terms/README.md).
 */

import type { Rule } from "./rule.js";
import { parseTerms } from "./terms.js";

/** A rule, or a line of terms such as `"mon-fri 09:00-17:00"`. */
export type PlainRule = Rule | string;

/** A wall-clock window from `"09:00-17:00"`, or a rule left as it is. */
export function asHours(hours: PlainRule): Rule {
  return typeof hours === "string" ? parseTerms(hours) : hours;
}

/** Whole days from `"2026-03-11"`, or a rule left as it is. */
export function asDays(scope: PlainRule): Rule {
  return typeof scope === "string" ? parseTerms(scope) : scope;
}
