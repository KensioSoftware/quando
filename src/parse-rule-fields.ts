/**
 * The table of rule types, and the check that a document matches one.
 *
 * Every type the language has, with the fields each one is allowed to carry.
 * One table rather than two, so the list of known types and the list of known
 * fields cannot drift apart. [parse.ts](./parse.ts) reads a rule; this decides
 * whether there is a rule there to read.
 */

import { checkFields, fail, shapeOf } from "./parse-shape.js";

/** Every rule type, and the fields it is allowed to carry. */
const FIELDS = new Map<string, readonly string[]>([
  ["always", []],
  ["never", []],
  ["daysOfWeek", ["days", "zone"]],
  ["daysOfMonth", ["days", "zone"]],
  ["nthDayOfWeekInMonth", ["nth", "days", "zone"]],
  ["monthsOfYear", ["months", "zone"]],
  ["monthCodes", ["codes", "zone"]],
  ["every", ["interval", "period", "anchor", "zone"]],
  ["timeOfDay", ["from", "to", "zone"]],
  ["dates", ["dates", "zone"]],
  ["dateRange", ["from", "to", "zone"]],
  ["atMost", ["count", "per", "within", "zone"]],
  ["spacedBy", ["gap"]],
  ["custom", ["name", "options", "zone"]],
  ["inCalendar", ["calendar", "rule"]],
  ["inZone", ["zone", "rule"]],
  ["known", ["through", "rule", "zone"]],
  ["all", ["rules"]],
  ["any", ["rules"]],
  ["not", ["rule"]],
]);

/**
 * Every rule type the language has, for the places that need the list without
 * the fields. Derived from the table above so the two cannot drift.
 */
export const RULE_TYPES: ReadonlySet<string> = new Set(FIELDS.keys());

/**
 * The type a rule document names, once its fields have been checked.
 *
 * Fails with the path and the list of real types where the document names
 * something else, because a rule arrives here from a database row or a form
 * and the useful thing to say is what is wrong and where.
 */
export function checkedType(
  node: Record<string, unknown>,
  path: string,
): string {
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
  return type;
}
