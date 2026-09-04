/**
 * Reading a cron expression down to its five fields.
 *
 * The shorthands are the expressions they stand for, expanded here so that
 * [cron.ts](./cron.ts) only ever sees five fields. `@reboot` has no time in
 * it at all and is refused along with anything else unrecognised.
 */

import { fail } from "./parse-shape.js";

/** The shorthands, as the five-field expressions they stand for. */
const SHORTHANDS = new Map([
  ["@yearly", "0 0 1 1 *"],
  ["@annually", "0 0 1 1 *"],
  ["@monthly", "0 0 1 * *"],
  ["@weekly", "0 0 * * 0"],
  ["@daily", "0 0 * * *"],
  ["@midnight", "0 0 * * *"],
  ["@hourly", "0 * * * *"],
]);

const SPACES = /\s+/u;

/** The five fields, in the order cron writes them. */
export type CronFields = readonly [string, string, string, string, string];

function isFive(fields: readonly string[]): fields is CronFields {
  return fields.length === 5;
}

export function expandedFields(expression: string): CronFields {
  const text = expression.trim();

  if (text.startsWith("@")) {
    const expanded = SHORTHANDS.get(text.toLowerCase());
    if (expanded === undefined) {
      return fail(
        "cron",
        `"${text}" is not a cron shorthand. Expected one of ${[...SHORTHANDS.keys()].join(", ")}`,
      );
    }
    // Straight back through the ordinary path. Every expansion above is a
    // five-field expression, so this reads it the way a written one is read.
    return expandedFields(expanded);
  }

  const fields = text.split(SPACES).filter((field) => field !== "");
  if (!isFive(fields)) {
    return fail(
      "cron",
      `expected five fields (minute hour day-of-month month day-of-week), found ${fields.length}`,
    );
  }
  return fields;
}
