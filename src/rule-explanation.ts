import type { Context } from "./context.js";
import { activeAt } from "./query.js";
import type { Rule } from "./rule.js";
import { describeRuleMatch } from "./rule-explanation-text.js";

/** Why one rule does or does not cover an instant. */
export interface RuleExplanation {
  readonly rule: Rule;
  readonly matched: boolean;
  readonly description: string;
  readonly conditions: readonly RuleExplanation[];
}

/** Describes how a rule evaluates at one instant. */
export function explainRule(
  rule: Rule,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): RuleExplanation {
  return explainInZone(rule, at, context);
}

function explainInZone(
  rule: Rule,
  at: Temporal.ZonedDateTime,
  context: Omit<Context, "from" | "to"> | undefined,
  inheritedZone?: string,
): RuleExplanation {
  const effective =
    inheritedZone === undefined
      ? rule
      : ({ type: "inZone", zone: inheritedZone, rule } as const);
  const matched = activeAt(effective, at, context);
  const conditions = childConditions(rule, at, context, inheritedZone);
  return {
    rule,
    matched,
    description: describeRuleMatch(
      rule,
      at,
      matched,
      conditions,
      inheritedZone,
    ),
    conditions,
  };
}

function childConditions(
  rule: Rule,
  at: Temporal.ZonedDateTime,
  context: Omit<Context, "from" | "to"> | undefined,
  inheritedZone: string | undefined,
): readonly RuleExplanation[] {
  switch (rule.type) {
    case "inZone": {
      return [explainInZone(rule.rule, at, context, rule.zone)];
    }
    case "all":
    case "any": {
      return rule.rules.map((child) =>
        explainInZone(child, at, context, inheritedZone),
      );
    }
    case "not": {
      return [explainInZone(rule.rule, at, context, inheritedZone)];
    }
    case "always":
    case "dates":
    case "dateRange":
    case "daysOfMonth":
    case "daysOfWeek":
    case "monthsOfYear":
    case "nthDayOfWeekInMonth":
    case "never":
    case "timeOfDay": {
      return [];
    }
  }
}
