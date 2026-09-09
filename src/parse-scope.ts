/**
 * Parsing the rules that wrap one other rule and select no time of their own.
 *
 * `inZone` settles which clock the rules inside it are read on, `inCalendar`
 * settles which calendar they count on, and `known` settles how far their
 * answer can be trusted. [parse.ts](./parse.ts) keeps the table of known types
 * and hands these here, the way it hands the leaves to `parse-calendar.ts`.
 */

import { asDate, zonePart } from "./parse-fields.js";
import { fail, shapeOf } from "./parse-shape.js";
import type {
  InCalendarRule,
  InZoneRule,
  KnownRule,
  RuleData,
} from "./rule.js";
import { asCalendar } from "./validation.js";

/** Parses the one rule a scope wraps. Passed in, because `parse.ts` recurses. */
type ParseRule = (value: unknown, path: string) => RuleData;

export function parseInCalendarRule(
  node: Record<string, unknown>,
  path: string,
  parseRule: ParseRule,
): InCalendarRule {
  const calendar = node["calendar"];
  if (typeof calendar !== "string") {
    return fail(
      `${path}.calendar`,
      `expected a calendar identifier, found ${shapeOf(calendar)}`,
    );
  }
  return {
    type: "inCalendar",
    calendar: asCalendar(calendar, `${path}.calendar`),
    rule: parseRule(node["rule"], `${path}.rule`),
  };
}

export function parseInZoneRule(
  node: Record<string, unknown>,
  path: string,
  parseRule: ParseRule,
): InZoneRule {
  const part = zonePart(node, path);
  if (part.zone === undefined) {
    return fail(`${path}.zone`, "expected a time zone");
  }
  return {
    type: "inZone",
    zone: part.zone,
    rule: parseRule(node["rule"], `${path}.rule`),
  };
}

/**
 * A horizon, which is the one wrapper that says something about the answer
 * rather than about how the times inside it are read.
 */
export function parseKnownRule(
  node: Record<string, unknown>,
  path: string,
  parseRule: ParseRule,
): KnownRule {
  const part = zonePart(node, path);
  return {
    type: "known",
    through: asDate(node["through"], `${path}.through`),
    rule: parseRule(node["rule"], `${path}.rule`),
    ...(part.zone === undefined ? {} : { zone: part.zone }),
  };
}
