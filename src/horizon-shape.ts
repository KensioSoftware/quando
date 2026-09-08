/**
 * Whether anything in a rule tree could make part of its answer unknown.
 *
 * The short-circuit that keeps horizons free for everyone who does not use
 * one. A rule with nothing to be unsure about has a single answer, and the
 * whole two-bound apparatus in [bounds.ts](./bounds.ts) is skipped for it.
 *
 * Walked once per document and remembered, because a query asks this at every
 * node it visits and rule documents do not change.
 */

import type { RuleRegistry } from "./custom-rules.js";
import type { Rule } from "./rule.js";

/** What a rule tree carries that could put a horizon on an answer. */
interface Shape {
  /** Whether a `known` rule appears anywhere in it. */
  readonly declared: boolean;
  /** The custom rule types it names, which the registry may put one on. */
  readonly custom: readonly string[];
}

/** A leaf that vouches for itself over all of time, which is most of them. */
const NOTHING_UNKNOWN: Shape = { declared: false, custom: [] };

const shapes = new WeakMap<Rule, Shape>();

/**
 * Whether anything in a rule could make part of its answer unknown.
 *
 * The short-circuit that keeps all of this free for everyone who does not use
 * it. A rule with no horizon in it has one answer rather than two bounds, and
 * every query over it behaves exactly as it did before horizons existed.
 */
export function hasHorizon(
  rule: Rule,
  registry: RuleRegistry | undefined,
): boolean {
  const shape = shapeOf(rule);
  return (
    shape.declared ||
    shape.custom.some((name) => registry?.[name]?.known !== undefined)
  );
}

/** The shape of a rule tree, walked once per document and remembered. */
function shapeOf(rule: Rule): Shape {
  const remembered = shapes.get(rule);
  if (remembered !== undefined) {
    return remembered;
  }
  const shape = walk(rule);
  shapes.set(rule, shape);
  return shape;
}

function walk(rule: Rule): Shape {
  switch (rule.type) {
    case "known": {
      return { declared: true, custom: shapeOf(rule.rule).custom };
    }
    case "custom": {
      return { declared: false, custom: [rule.name] };
    }
    case "not":
    case "inZone":
    case "inCalendar": {
      return shapeOf(rule.rule);
    }
    case "all":
    case "any": {
      return merged(rule.rules);
    }
    case "always":
    case "never":
    case "daysOfWeek":
    case "daysOfMonth":
    case "nthDayOfWeekInMonth":
    case "monthsOfYear":
    case "monthCodes":
    case "every":
    case "timeOfDay":
    case "dates":
    case "dateRange":
    case "atMost":
    case "spacedBy": {
      return NOTHING_UNKNOWN;
    }
  }
}

function merged(rules: readonly Rule[]): Shape {
  let declared = false;
  const custom = new Set<string>();
  for (const rule of rules) {
    const shape = shapeOf(rule);
    declared ||= shape.declared;
    for (const name of shape.custom) {
      custom.add(name);
    }
  }
  return { declared, custom: [...custom] };
}
