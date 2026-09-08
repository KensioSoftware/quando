/**
 * Turning arbitrary JSON back into a rule.
 *
 * This is the boundary. Rules are meant to be stored, sent and edited, so what
 * comes back is whatever a database row, an API body or a form actually holds
 * — and the useful thing to do with a bad one is say precisely what is wrong
 * and where, rather than fail somewhere further in with the reason lost.
 *
 * Shape and vocabulary are checked here: is it an object, is the type one that
 * exists, are those really days of the week, does that parse as a time. What a
 * rule *means* is not — `interpret.ts` owns that, and duplicating it here would
 * only give the two somewhere to disagree.
 */

import { parseCalendarRule } from "./parse-calendar.js";
import {
  parseAtMostRule,
  parseAtMostTimeRule,
  parseSpacedByRule,
} from "./parse-constraint.js";
import { parseCustomRule } from "./parse-custom.js";
import { asRecord, fail, shapeOf } from "./parse-shape.js";
import { checkedType } from "./parse-rule-fields.js";
import { build, type Built } from "./build.js";
import {
  parseInCalendarRule,
  parseInZoneRule,
  parseKnownRule,
} from "./parse-scope.js";
import type { Rule } from "./rule.js";

export { RULE_TYPES } from "./parse-rule-fields.js";

function asRules(value: unknown, path: string): Rule[] {
  if (!Array.isArray(value)) {
    return fail(path, `expected an array of rules, found ${shapeOf(value)}`);
  }
  return value.map((rule, index) => parseRuleData(rule, `${path}[${index}]`));
}

/**
 * A rule from unknown JSON, or a `TypeError` saying what is wrong and where.
 *
 * The `path` is what appears in front of every message, so a rule nested six
 * deep reports as `rule.rules[2].rules[0].days[3]` rather than as a puzzle.
 */
function parseRuleData(value: unknown, path: string): Rule {
  const node = asRecord(value, path, "a rule object");
  const type = checkedType(node, path);

  switch (type) {
    case "always": {
      return { type: "always" };
    }

    case "never": {
      return { type: "never" };
    }

    case "daysOfWeek":
    case "daysOfMonth":
    case "nthDayOfWeekInMonth":
    case "monthsOfYear":
    case "monthCodes":
    case "every":
    case "dates":
    case "dateRange":
    case "timeOfDay": {
      return parseCalendarRule(type, node, path);
    }

    case "atMost": {
      return parseAtMostRule(node, path);
    }

    case "atMostTime": {
      return parseAtMostTimeRule(node, path);
    }

    case "spacedBy": {
      return parseSpacedByRule(node, path);
    }

    case "custom": {
      return parseCustomRule(node, path);
    }

    case "inCalendar": {
      return parseInCalendarRule(node, path, parseRuleData);
    }

    case "inZone": {
      return parseInZoneRule(node, path, parseRuleData);
    }

    case "known": {
      return parseKnownRule(node, path, parseRuleData);
    }

    case "all": {
      return { type: "all", rules: asRules(node["rules"], `${path}.rules`) };
    }

    case "any": {
      return { type: "any", rules: asRules(node["rules"], `${path}.rules`) };
    }

    default: {
      return {
        type: "not",
        rule: parseRuleData(node["rule"], `${path}.rule`),
      };
    }
  }
}

/** A validated rule with fluent composition methods restored. */
export function parseRule(value: unknown, path = "rule"): Built<Rule> {
  return build(parseRuleData(value, path));
}
