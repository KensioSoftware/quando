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

import { asDates, asDays, asTime, zonePart } from "./parse-fields.js";
import { asRecord, checkFields, fail, shapeOf } from "./parse-shape.js";
import type { Rule } from "./rule.js";

/**
 * Every rule type, and the fields it is allowed to carry. One table rather than
 * two, so the list of known types and the list of known fields cannot drift.
 */
const FIELDS = new Map<string, readonly string[]>([
  ["always", []],
  ["never", []],
  ["daysOfWeek", ["days", "zone"]],
  ["timeOfDay", ["from", "to", "zone"]],
  ["dates", ["dates", "zone"]],
  ["all", ["rules"]],
  ["any", ["rules"]],
  ["not", ["rule"]],
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
  const node = asRecord(value, path, "a rule object");
  const type = node["type"];

  if (typeof type !== "string") {
    return fail(`${path}.type`, `expected a string, found ${shapeOf(type)}`);
  }

  const allowed = FIELDS.get(type);
  if (allowed === undefined) {
    return fail(
      `${path}.type`,
      `"${type}" is not a rule type. Expected one of ${[...FIELDS.keys()].join(", ")}`,
    );
  }
  checkFields(node, allowed, path, `a ${type} rule`);

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
