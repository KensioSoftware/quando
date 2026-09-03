import {
  describeDate,
  describeDay,
  describeTime,
} from "./calendar-explanation-text.js";
import type { Rule } from "./rule.js";
import type { RuleExplanation } from "./rule-explanation.js";

/** Writes the automatic account of one rule evaluation. */
export function describeRuleMatch(
  rule: Rule,
  at: Temporal.ZonedDateTime,
  matched: boolean,
  conditions: readonly RuleExplanation[],
  inheritedZone: string | undefined,
): string {
  switch (rule.type) {
    case "always": {
      return "This rule always matches.";
    }
    case "never": {
      return "This rule never matches.";
    }
    case "daysOfWeek": {
      return inNamedZone(
        describeDay(rule.days, localAt(at, rule.zone ?? inheritedZone)),
        rule.zone,
      );
    }
    case "dates": {
      return inNamedZone(
        describeDate(
          rule.dates,
          localAt(at, rule.zone ?? inheritedZone),
          matched,
        ),
        rule.zone,
      );
    }
    case "timeOfDay": {
      return inNamedZone(
        describeTime(
          rule.from,
          rule.to,
          localAt(at, rule.zone ?? inheritedZone),
          matched,
        ),
        rule.zone,
      );
    }
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
    default: {
      const unreachable: never = rule;
      return unreachable;
    }
  }
}

function localAt(
  at: Temporal.ZonedDateTime,
  zone: string | undefined,
): Temporal.ZonedDateTime {
  return zone === undefined ? at : at.withTimeZone(zone);
}

function inNamedZone(description: string, zone: string | undefined): string {
  return zone === undefined
    ? description
    : `The rule uses ${zone}. ${description}`;
}

function combinedDescription(
  opening: string,
  conditions: readonly RuleExplanation[],
): string {
  return [opening, ...conditions.map(({ description }) => description)].join(
    " ",
  );
}
