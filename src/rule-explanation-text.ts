import { describeCalendarMatch } from "./calendar-match-text.js";
import { describeCompoundMatch } from "./compound-explanation-text.js";
import { describeCustomMatch } from "./custom-match-text.js";
import { describeConstraintMatch } from "./constraint-match-text.js";
import type { Context } from "./context.js";
import type { Rule } from "./rule.js";
import type { RuleExplanation, RuleScope } from "./rule-explanation.js";

/** Writes the automatic account of one rule evaluation. */
export function describeRuleMatch(
  rule: Rule,
  at: Temporal.ZonedDateTime,
  matched: boolean,
  conditions: readonly RuleExplanation[],
  scope: RuleScope,
  read: Omit<Context, "from" | "to"> | undefined,
): string {
  switch (rule.type) {
    case "always": {
      return "This rule always matches.";
    }
    case "never": {
      return "This rule never matches.";
    }
    case "daysOfWeek":
    case "daysOfMonth":
    case "nthDayOfWeekInMonth":
    case "monthCodes":
    case "monthsOfYear":
    case "every":
    case "dateRange":
    case "dates":
    case "timeOfDay": {
      return describeCalendarMatch(rule, at, matched, scope);
    }

    case "atMost":
    case "spacedBy": {
      return describeConstraintMatch(rule, at, matched, read);
    }

    case "custom": {
      return describeCustomMatch(rule, matched, read?.rules);
    }

    case "inZone":
    case "inCalendar":
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
