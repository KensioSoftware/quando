import type { Context } from "./context.js";
import { certaintyAt } from "./horizon-guard.js";
import type { Rule } from "./rule.js";
import { describeRuleMatch } from "./rule-explanation-text.js";

/** Why one rule does or does not cover an instant. */
export interface RuleExplanation {
  readonly rule: Rule;
  readonly matched: boolean;
  /**
   * Whether the rules can answer for this instant at all.
   *
   * `true` for every rule that declares no horizon. Where it is `false` the
   * rule stopped being evidence before the instant asked about, and `matched`
   * is `false` because nothing is known to match rather than because anything
   * was ruled out.
   */
  readonly known: boolean;
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
  rule: Rule,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): RuleExplanation {
  return explainInScope(rule, at, context, {});
}

/** The rule wrapped in its scope. This is the form that is evaluated. */
function scoped(rule: Rule, scope: RuleScope): Rule {
  const onCalendar =
    scope.calendar === undefined
      ? rule
      : ({ type: "inCalendar", calendar: scope.calendar, rule } as const);
  return scope.zone === undefined
    ? onCalendar
    : { type: "inZone", zone: scope.zone, rule: onCalendar };
}

function explainInScope(
  rule: Rule,
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
    matched,
    known,
    description: known
      ? describeRuleMatch(rule, at, matched, conditions, scope, context)
      : "Whether this matches is not known. The rules stop being known " +
        "before this time.",
    conditions,
  };
}

function childConditions(
  rule: Rule,
  at: Temporal.ZonedDateTime,
  context: Omit<Context, "from" | "to"> | undefined,
  scope: RuleScope,
): readonly RuleExplanation[] {
  switch (rule.type) {
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
