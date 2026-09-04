import {
  describeDate,
  describeDay,
  describeTime,
} from "./calendar-explanation-text.js";
import {
  describeMonth,
  describeMonthDay,
  describeNthDayOfWeekInMonth,
} from "./month-explanation-text.js";
import { describeCompoundMatch } from "./compound-explanation-text.js";
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
    case "daysOfMonth": {
      return inNamedZone(
        describeMonthDay(
          rule.days,
          localAt(at, rule.zone ?? inheritedZone),
          matched,
        ),
        rule.zone,
      );
    }
    case "nthDayOfWeekInMonth": {
      return inNamedZone(
        describeNthDayOfWeekInMonth(
          rule.nth,
          rule.days,
          localAt(at, rule.zone ?? inheritedZone),
          matched,
        ),
        rule.zone,
      );
    }
    case "monthsOfYear": {
      return inNamedZone(
        describeMonth(rule.months, localAt(at, rule.zone ?? inheritedZone)),
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
    case "inZone":
    case "all":
    case "any":
    case "not": {
      return describeCompoundMatch(rule, matched, conditions);
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
