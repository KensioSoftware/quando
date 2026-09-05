/**
 * The leaves of an `any`, flattened.
 *
 * Both notations have places that mean union — `BYDAY` naming several days,
 * cron's two day fields — and each of them holds selections and nothing else.
 * So an alternative that is itself a union flattens into the one around it,
 * and an alternative holding an `all` or a `not` is a shape neither notation
 * has anywhere.
 */

import { type Unwritable, unwritable } from "./export-result.js";
import type { CalendarRule, Rule } from "./rule.js";

interface Union {
  readonly ok: true;
  readonly leaves: CalendarRule[];
}

export function unionOf(
  rules: readonly Rule[],
  zones: Set<string>,
): Union | Unwritable {
  const leaves: CalendarRule[] = [];

  for (const rule of rules) {
    if (rule.type === "any") {
      const nested = unionOf(rule.rules, zones);
      if (!nested.ok) {
        return nested;
      }
      leaves.push(...nested.leaves);
      continue;
    }

    const leaf = leafOf(rule);
    if (leaf === undefined) {
      return unwritable(
        `one of its alternatives is ${rule.type}, and an alternative has to be a single selection`,
      );
    }
    if (leaf.zone !== undefined) {
      zones.add(leaf.zone);
    }
    leaves.push(leaf);
  }

  return { ok: true, leaves };
}

/** A rule as a leaf, or nothing when it holds other rules. */
function leafOf(rule: Rule): CalendarRule | undefined {
  switch (rule.type) {
    case "daysOfWeek":
    case "daysOfMonth":
    case "nthDayOfWeekInMonth":
    case "monthsOfYear":
    case "every":
    case "timeOfDay":
    case "dates":
    case "dateRange": {
      return rule;
    }
    case "always":
    case "never":
    case "inZone":
    case "all":
    case "any":
    case "not": {
      return undefined;
    }
  }
}
