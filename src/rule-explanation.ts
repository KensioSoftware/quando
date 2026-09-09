import type { Context } from "./context.js";
import { certaintyAt } from "./rule-certainty.js";
import { describeRuleMatch } from "./rule-explanation-text.js";
import type { RuleData } from "./rule.js";
/** Why one rule does or does not cover an instant. */
export interface RuleExplanation {
  readonly rule: RuleData;
  readonly status: "matched" | "unmatched" | "unknown";
  readonly description: string;
  readonly conditions: readonly RuleExplanation[];
}

/**
 * The zone and calendar a rule reads under, carried down from the wrappers
 * above it.
 *
 * A child of an `inZone` or an `inCalendar` is explained on its own, away from
 * the wrapper that sets how it reads a date. Without the scope travelling with
 * it, `daysOfMonth(1)` under `inCalendar("hebrew", ...)` would be evaluated and
 * described on the ISO calendar, and would report the opposite of what its
 * parent reported.
 */
export interface RuleScope {
  readonly zone?: string;
  readonly calendar?: string;
}

/** Describes how a rule evaluates at one instant. */
export function explainRule(
  rule: RuleData,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): RuleExplanation {
  return explainInScope(rule, at, context, {});
}

/** The rule wrapped in its scope. This is the form that is evaluated. */
function scoped(rule: RuleData, scope: RuleScope): RuleData {
  const onCalendar =
    scope.calendar === undefined
      ? rule
      : ({ type: "inCalendar", calendar: scope.calendar, rule } as const);
  return scope.zone === undefined
    ? onCalendar
    : { type: "inZone", zone: scope.zone, rule: onCalendar };
}

function explainInScope(
  rule: RuleData,
  at: Temporal.ZonedDateTime,
  context: Omit<Context, "from" | "to"> | undefined,
  scope: RuleScope,
): RuleExplanation {
  const certainty = certaintyAt(scoped(rule, scope), at, context);
  const matched = certainty === "covered";
  const known = certainty !== "unknown";
  const conditions = childConditions(rule, at, context, scope);
  return {
    rule,
    status: known ? (matched ? "matched" : "unmatched") : "unknown",
    description: known
      ? describeRuleMatch(rule, at, matched, conditions, scope, context)
      : "Whether this matches is not known. The rules stop being known " +
        "before this time.",
    conditions,
  };
}

function childConditions(
  rule: RuleData,
  at: Temporal.ZonedDateTime,
  context: Omit<Context, "from" | "to"> | undefined,
  scope: RuleScope,
): readonly RuleExplanation[] {
  switch (rule.type) {
    case "shiftDays": {
      return [
        explainInScope(
          rule.rule,
          at.subtract({ days: rule.days }),
          context,
          scope,
        ),
      ];
    }
    case "inZone": {
      return [
        explainInScope(rule.rule, at, context, { ...scope, zone: rule.zone }),
      ];
    }
    case "inCalendar": {
      return [
        explainInScope(rule.rule, at, context, {
          ...scope,
          calendar: rule.calendar,
        }),
      ];
    }
    case "all":
    case "any": {
      return rule.rules.map((child) =>
        explainInScope(child, at, context, scope),
      );
    }
    case "not":
    case "known": {
      return [explainInScope(rule.rule, at, context, scope)];
    }
    case "atMost":
    case "atMostTime":
    case "spacedBy":
    case "custom":
    case "always":
    case "dates":
    case "dateRange":
    case "every":
    case "daysOfMonth":
    case "daysOfWeek":
    case "monthCodes":
    case "monthsOfYear":
    case "nthDayOfWeekInMonth":
    case "never":
    case "timeOfDay": {
      return [];
    }
  }
}
