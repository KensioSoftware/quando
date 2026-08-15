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

import {
  asDates,
  asDays,
  asRecord,
  asTime,
  fail,
  shapeOf,
  zonePart,
} from "./parse-fields.js";
import type { Rule } from "./rule.js";

const RULE_TYPES = new Set([
  "always",
  "never",
  "daysOfWeek",
  "timeOfDay",
  "dates",
  "all",
  "any",
  "not",
]);

function asRules(value: unknown, path: string): Rule[] {
  if (!Array.isArray(value)) {
    return fail(path, `expected an array of rules, found ${shapeOf(value)}`);
  }
  return value.map((rule, index) => parseRule(rule, `${path}[${index}]`));
}

/**
 * A rule from unknown JSON, or a `TypeError` saying what is wrong and where.
 *
 * The `path` is what appears in front of every message, so a rule nested six
 * deep reports as `rule.rules[2].rules[0].days[3]` rather than as a puzzle.
 */
export function parseRule(value: unknown, path = "rule"): Rule {
  const node = asRecord(value, path);
  const type = node["type"];

  if (typeof type !== "string") {
    return fail(`${path}.type`, `expected a string, found ${shapeOf(type)}`);
  }
  if (!RULE_TYPES.has(type)) {
    return fail(
      `${path}.type`,
      `"${type}" is not a rule type. Expected one of ${[...RULE_TYPES].join(", ")}`,
    );
  }

  switch (type) {
    case "always": {
      return { type: "always" };
    }

    case "never": {
      return { type: "never" };
    }

    case "daysOfWeek": {
      return {
        type: "daysOfWeek",
        days: asDays(node["days"], `${path}.days`),
        ...zonePart(node, path),
      };
    }

    case "dates": {
      return {
        type: "dates",
        dates: asDates(node["dates"], `${path}.dates`),
        ...zonePart(node, path),
      };
    }

    case "timeOfDay": {
      return {
        type: "timeOfDay",
        from: asTime(node["from"], `${path}.from`),
        to: asTime(node["to"], `${path}.to`),
        ...zonePart(node, path),
      };
    }

    case "all": {
      return { type: "all", rules: asRules(node["rules"], `${path}.rules`) };
    }

    case "any": {
      return { type: "any", rules: asRules(node["rules"], `${path}.rules`) };
    }

    default: {
      return { type: "not", rule: parseRule(node["rule"], `${path}.rule`) };
    }
  }
}
