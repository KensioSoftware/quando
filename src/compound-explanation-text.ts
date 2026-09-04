/**
 * Describing the rules that hold other rules.
 *
 * These say nothing about calendars or clocks. What they describe is the
 * logic — every condition, at least one alternative, the excluded one — and
 * the account of each child is already written by the time it gets here.
 */

import type { AllRule, AnyRule, InZoneRule, NotRule } from "./rule.js";
import type { RuleExplanation } from "./rule-explanation.js";

export function describeCompoundMatch(
  rule: AllRule | AnyRule | NotRule | InZoneRule,
  matched: boolean,
  conditions: readonly RuleExplanation[],
): string {
  switch (rule.type) {
    case "inZone": {
      return `The rule uses ${rule.zone}. ${conditions[0]?.description ?? ""}`;
    }
    case "all": {
      if (conditions.length === 0) {
        return "An empty all rule always matches.";
      }
      return combinedDescription(
        matched
          ? "Every condition matches."
          : "A required condition does not match.",
        conditions,
      );
    }
    case "any": {
      if (conditions.length === 0) {
        return "An empty any rule never matches.";
      }
      return combinedDescription(
        matched
          ? "At least one alternative matches."
          : "No alternative matches.",
        conditions,
      );
    }
    case "not": {
      return combinedDescription(
        matched
          ? "The excluded condition does not match."
          : "The excluded condition matches.",
        conditions,
      );
    }
  }
}

function combinedDescription(
  opening: string,
  conditions: readonly RuleExplanation[],
): string {
  return [opening, ...conditions.map(({ description }) => description)].join(
    " ",
  );
}
