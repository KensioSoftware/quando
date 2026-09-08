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
import { canonicalDuration } from "./canonical-leaves.js";
import { canonicalJson } from "./canonical-json.js";
import { combined } from "./canonical-compound.js";
import type { Rule } from "./rule.js";

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
    case "monthCodes":
    case "every":
    case "dates":
    case "dateRange":
    case "timeOfDay": {
      return canonicalCalendarRule(rule);
    }

    case "atMost": {
      // The window is one field or the other and never both, so the one that
      // is set is the one written.
      return {
        type: "atMost",
        count: rule.count,
        ...(rule.within === undefined
          ? { per: rule.per }
          : { within: canonicalDuration(rule.within) }),
        ...(rule.zone === undefined ? {} : { zone: rule.zone }),
      };
    }

    case "spacedBy": {
      return { type: "spacedBy", gap: canonicalDuration(rule.gap) };
    }

    case "custom": {
      // Opaque, and written the one way it can be: the fields in a fixed
      // order and the options with their object keys sorted. What the options
      // mean belongs to whoever implements the rule, so nothing here reads
      // them.
      return {
        type: "custom",
        name: rule.name,
        ...(rule.options === undefined
          ? {}
          : { options: canonicalJson(rule.options) }),
        ...(rule.zone === undefined ? {} : { zone: rule.zone }),
      };
    }

    case "inCalendar": {
      return {
        type: "inCalendar",
        calendar: rule.calendar,
        rule: canonicalRule(rule.rule),
      };
    }

    case "inZone": {
      return {
        type: "inZone",
        zone: rule.zone,
        rule: canonicalRule(rule.rule),
      };
    }

    case "known": {
      return {
        type: "known",
        through: rule.through,
        rule: canonicalRule(rule.rule),
        ...(rule.zone === undefined ? {} : { zone: rule.zone }),
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
      return combined(rule.type, rule.rules, canonicalRule);
    }
  }
}
