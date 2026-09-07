/**
 * Parsing the two rules that change how a subtree is read.
 *
 * Neither selects any time of its own. `inZone` settles which clock the rules
 * inside it are read on and `inCalendar` settles which calendar they count on,
 * and both hold exactly one rule. [parse.ts](./parse.ts) keeps the table of
 * known types and hands these here, the way it hands the leaves to
 * `parse-calendar.ts`.
 */

import { zonePart } from "./parse-fields.js";
import { fail, shapeOf } from "./parse-shape.js";
import type { InCalendarRule, InZoneRule, Rule } from "./rule.js";
import { asCalendar } from "./validation.js";

/** Parses the one rule a scope wraps. Passed in, because `parse.ts` recurses. */
type ParseRule = (value: unknown, path: string) => Rule;

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
