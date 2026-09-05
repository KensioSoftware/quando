/**
 * Reading the value of one RRULE part.
 *
 * `BYDAY` is the awkward one. Its entries are weekday codes that may carry an
 * ordinal, and the ordinal means a different thing under `MONTHLY` than it
 * does under `WEEKLY`, where RFC 5545 says it has no meaning at all.
 */

import { fail } from "./parse-shape.js";
import type { Weekday } from "./rule.js";

/** RFC 5545 writes the week starting on Sunday, in two-letter codes. */
const DAY_CODES = new Map<string, Weekday>([
  ["SU", "sunday"],
  ["MO", "monday"],
  ["TU", "tuesday"],
  ["WE", "wednesday"],
  ["TH", "thursday"],
  ["FR", "friday"],
  ["SA", "saturday"],
]);

const ORDINAL_DAY = /^(?<ordinal>[+-]?\d{1,2})?(?<code>[A-Z]{2})$/u;

/** One `BYDAY` entry: a weekday, and which one in the period if it says. */
export interface ByDay {
  readonly day: Weekday;
  readonly ordinal?: number;
}

export function parseByDay(value: string): ByDay[] {
  return splitValue(value, "BYDAY").map((entry) => {
    const match = ORDINAL_DAY.exec(entry.toUpperCase());
    const code = match?.groups?.["code"];
    const day = code === undefined ? undefined : DAY_CODES.get(code);
    if (day === undefined) {
      return fail(
        "BYDAY",
        `"${entry}" is not a weekday. Expected one of ${[...DAY_CODES.keys()].join(", ")}, optionally after a number`,
      );
    }

    const written = match?.groups?.["ordinal"];
    if (written === undefined) {
      return { day };
    }

    const ordinal = Number(written);
    if (ordinal === 0 || ordinal < -5 || ordinal > 5) {
      return fail(
        "BYDAY",
        `"${entry}" counts an occurrence no month holds. Expected 1 to 5, or -1 to -5 counting back from the end`,
      );
    }
    return { day, ordinal };
  });
}

/**
 * A comma-separated list of whole numbers, each checked against a range.
 *
 * A range reaching below zero is one counted from both ends of a period, and
 * those have no zero. `BYMONTHDAY=-1` is the last day of the month and
 * `BYMONTHDAY=0` is nothing at all.
 */
export function parseNumbers(
  value: string,
  name: string,
  low: number,
  high: number,
): number[] {
  return splitValue(value, name).map((entry) => {
    const number = Number(entry);
    const signed = low < 0;
    if (
      !/^[+-]?\d+$/u.test(entry) ||
      number < low ||
      number > high ||
      (signed && number === 0)
    ) {
      return fail(
        name,
        signed
          ? `"${entry}" is out of range. Expected 1 to ${high}, or -1 to ${low} counting back from the end`
          : `"${entry}" is out of range. Expected ${low} to ${high}`,
      );
    }
    return number;
  });
}

/** One part's value as numbers, or nothing when the part is absent. */
export function partNumbers(
  parts: Map<string, string>,
  name: string,
  low: number,
  high: number,
): number[] | undefined {
  const written = parts.get(name);
  return written === undefined
    ? undefined
    : parseNumbers(written, name, low, high);
}

function splitValue(value: string, name: string): string[] {
  const entries = value.split(",").filter((entry) => entry !== "");
  return entries.length === 0 ? fail(name, "is empty") : entries;
}
