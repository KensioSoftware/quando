/**
 * A rule flattened into the conjunction cron and RRULE are both shaped like.
 *
 * Neither notation has structure. A cron expression is five fields that all
 * have to match, and a recurrence is a frequency with parts that narrow it, so
 * both are one `all` of selections and nothing else. Getting a rule into that
 * shape is the first half of writing either one, and it is the same half.
 *
 * A term is one of those selections: a single leaf, or the union of several.
 * `any` survives because both notations have places that mean union — a
 * `BYDAY` naming several days, cron's two day fields — and the leaves inside
 * one say which place it is.
 */

import { type Unwritable, unwritable } from "./export-result.js";
import type { CalendarRule, Rule } from "./rule.js";
import { unionOf } from "./rule-union.js";

/**
 * One selection the rule makes: a leaf, or the union of several leaves.
 *
 * Never empty. A union of nothing covers no time, and it is refused where it
 * is found rather than left for each writer to notice.
 */
export type Term = readonly [CalendarRule, ...CalendarRule[]];

/** A rule as the terms every one of which must hold, and the zone it uses. */
export interface Terms {
  readonly ok: true;
  readonly zone: string | undefined;
  readonly terms: readonly Term[];
}

/**
 * The terms a rule comes to, or why it has none.
 *
 * Nested `all` flattens, `always` drops out, and a zone anywhere in the rule
 * is lifted to the whole of it — a notation has one clock, so two zones in one
 * rule is where this stops.
 */
export function ruleTerms(rule: Rule): Terms | Unwritable {
  const terms: Term[] = [];
  const zones = new Set<string>();

  const problem = collect(rule, terms, zones);
  if (problem !== undefined) {
    return problem;
  }
  if (zones.size > 1) {
    return unwritable(
      `it is read in more than one zone (${[...zones].join(", ")}), and a schedule in a notation runs on one clock`,
    );
  }
  return { ok: true, zone: [...zones][0], terms };
}

function collect(
  rule: Rule,
  into: Term[],
  zones: Set<string>,
): Unwritable | undefined {
  switch (rule.type) {
    case "always": {
      // Narrows nothing, so it adds no term. An `all` of nothing but `always`
      // leaves no terms at all, which is every minute and writes as one.
      return undefined;
    }
    case "never": {
      return unwritable("it covers no time, and there is nothing to write");
    }
    case "not": {
      return unwritable(
        "it excludes times, and both notations only select them. Write the rule it excludes from, and keep the exception beside it",
      );
    }
    case "inZone": {
      zones.add(rule.zone);
      return collect(rule.rule, into, zones);
    }
    case "all": {
      for (const child of rule.rules) {
        const problem = collect(child, into, zones);
        if (problem !== undefined) {
          return problem;
        }
      }
      return undefined;
    }
    case "any": {
      const union = unionOf(rule.rules, zones);
      if (!union.ok) {
        return union;
      }
      const [first, ...rest] = union.leaves;
      if (first === undefined) {
        return unwritable("it offers no alternatives, and covers no time");
      }
      into.push([first, ...rest]);
      return undefined;
    }
    case "daysOfWeek":
    case "daysOfMonth":
    case "nthDayOfWeekInMonth":
    case "monthsOfYear":
    case "every":
    case "timeOfDay":
    case "dates":
    case "dateRange": {
      if (rule.zone !== undefined) {
        zones.add(rule.zone);
      }
      into.push([rule]);
      return undefined;
    }
  }
}
