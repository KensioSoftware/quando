/**
 * The one form of a rule that says what a rule says.
 *
 * `.except(…)` is `all(this, not(any(…)))` spelled out, so a rule built with
 * it carries an `all` inside an `all`. Nothing is wrong with that, and it does
 * mean two rules a reader would call identical are two different documents.
 * Comparing them, hashing them or diffing them all want the same thing first,
 * which is a form that depends on what a rule says rather than on how it was
 * written.
 *
 * The normal form here is syntactic. It flattens, drops identities, collapses
 * double negation, sorts and deduplicates, and stops. Two rules that *cover
 * the same time* by different routes stay different, because deciding that in
 * general means evaluating them over all of time. `always` and the seven days
 * of the week are the pair to keep in mind.
 *
 * Nothing here throws. A rule holding a date that will not parse comes back
 * with that date untouched, because a function used for cache keys is worth
 * more total than strict, and `parseRule` is the place that refuses.
 */

import { canonicalCalendarRule } from "./canonical-calendar.js";
import type { Rule } from "./rule.js";

/** A rule's stable string form, which is what sorting and equality compare. */
function key(rule: Rule): string {
  return JSON.stringify(rule);
}

/**
 * The operands of an `all` or an `any`, flattened, reduced and ordered.
 *
 * Both are the same shape with the two constants swapped. For `all`, `always`
 * adds nothing and `never` settles it. For `any` it is the other way round.
 */
function combined(type: "all" | "any", rules: readonly Rule[]): Rule {
  const absorbed = type === "all" ? "always" : "never";
  const settles = type === "all" ? "never" : "always";

  const flat: Rule[] = [];
  for (const rule of rules) {
    const inner = canonicalRule(rule);

    if (inner.type === settles) {
      return { type: settles };
    }
    if (inner.type === absorbed) {
      continue;
    }
    // Already canonical, so its own operands are reduced and its type is not
    // the one being flattened into unless it genuinely nests.
    if (inner.type === type) {
      flat.push(...inner.rules);
      continue;
    }
    flat.push(inner);
  }

  const kept = [...new Map(flat.map((rule) => [key(rule), rule])).values()];
  const unique = kept.toSorted((a, b) => key(a).localeCompare(key(b)));
  const only = unique[0];

  if (only === undefined) {
    return { type: absorbed };
  }
  return unique.length === 1 ? only : { type, rules: unique };
}

export function canonicalRule(rule: Rule): Rule {
  switch (rule.type) {
    case "always":
    case "never": {
      return { type: rule.type };
    }

    case "daysOfWeek":
    case "daysOfMonth":
    case "nthDayOfWeekInMonth":
    case "monthsOfYear":
    case "every":
    case "dates":
    case "dateRange":
    case "timeOfDay": {
      return canonicalCalendarRule(rule);
    }

    case "inZone": {
      return {
        type: "inZone",
        zone: rule.zone,
        rule: canonicalRule(rule.rule),
      };
    }

    case "not": {
      const inner = canonicalRule(rule.rule);
      // Two complements cancel, and the complement of a constant is the other
      // one. Both keep a `not` out of the form where it says nothing.
      if (inner.type === "not") {
        return inner.rule;
      }
      if (inner.type === "always") {
        return { type: "never" };
      }
      if (inner.type === "never") {
        return { type: "always" };
      }
      return { type: "not", rule: inner };
    }

    case "all":
    case "any": {
      return combined(rule.type, rule.rules);
    }
  }
}
