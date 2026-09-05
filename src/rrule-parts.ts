/**
 * Splitting an RRULE into the parts it names.
 *
 * A part Quando has no rule for is refused by name. Ignoring one would change
 * what the recurrence means and say nothing about it, which is the same
 * reasoning `checkFields` gives for refusing an unknown field on a rule
 * document.
 */

import { fail } from "./parse-shape.js";

/** Parts that map onto a rule. */
const SUPPORTED = new Set([
  "FREQ",
  "INTERVAL",
  "UNTIL",
  "WKST",
  "BYDAY",
  "BYMONTHDAY",
  "BYMONTH",
  "BYHOUR",
  "BYMINUTE",
]);

/**
 * Parts that exist and have no rule to map onto, with what to say about each.
 *
 * Named individually rather than lumped together, because "Quando cannot do
 * this" and "Quando will not do this" are different answers and a reader
 * deserves to know which one they have.
 */
const UNSUPPORTED = new Map([
  [
    "COUNT",
    "a count of occurrences is not something a rule can express. Bound the recurrence with UNTIL, or take what you need from the interval stream",
  ],
  [
    "BYSETPOS",
    "selecting the nth occurrence within a period needs the occurrences counted, which a rule does not do",
  ],
  ["BYWEEKNO", "week numbers have no rule to map onto"],
  ["BYYEARDAY", "days of the year have no rule to map onto"],
  ["BYSECOND", "Quando reads recurrences down to the minute"],
]);

export function rruleParts(text: string): Map<string, string> {
  const body = text.trim().replace(/^RRULE:/iu, "");
  const parts = new Map<string, string>();

  for (const piece of separated(body, ";", "rrule")) {
    const equals = piece.indexOf("=");
    if (equals === -1) {
      return fail("rrule", `"${piece}" is not a NAME=VALUE part`);
    }

    const name = piece.slice(0, equals).toUpperCase();
    const unsupported = UNSUPPORTED.get(name);
    if (unsupported !== undefined) {
      return fail(name, unsupported);
    }
    if (!SUPPORTED.has(name)) {
      return fail(
        "rrule",
        `"${name}" is not a recurrence rule part. Expected one of ${[...SUPPORTED].join(", ")}`,
      );
    }
    if (parts.has(name)) {
      return fail(name, "is given twice");
    }

    parts.set(name, piece.slice(equals + 1));
  }

  if (!parts.has("FREQ")) {
    return fail("rrule", "FREQ is required");
  }
  return parts;
}

/**
 * The pieces between separators, with a trailing separator forgiven.
 *
 * Generated calendar data often ends a list with one, and nothing is missing
 * when it does. A separator in the middle is a different thing: something was
 * meant to be there. Skipping it quietly would accept a recurrence one part
 * short and say nothing about it.
 */
export function separated(
  text: string,
  separator: string,
  path: string,
): string[] {
  const pieces = text.split(separator);
  while (pieces.at(-1) === "") {
    pieces.pop();
  }
  return pieces.some((piece) => piece === "")
    ? fail(path, `"${text}" has an empty entry`)
    : pieces;
}
