/**
 * Reading one field of a cron expression as the set of numbers it selects.
 *
 * Every field has the same grammar over a different range. A star is all of
 * it, `a` is one, `a-b` is a range, a trailing slash and a number steps
 * through either of those, and commas join any of them. Names are accepted
 * where cron accepts them.
 *
 * The result is a sorted set of numbers. What those numbers mean is
 * [cron.ts](./cron.ts)'s problem, and the fields themselves are in
 * [cron-field-types.ts](./cron-field-types.ts).
 */

import type { CronField, CronSelection } from "./cron-field-types.js";
import { fail } from "./parse-shape.js";

const WHOLE_NUMBER = /^\d+$/u;

export function parseCronField(text: string, field: CronField): CronSelection {
  const selected = new Set<number>();
  let restricted = false;

  for (const part of text.split(",")) {
    if (part === "") {
      return fail(field.name, `"${text}" has an empty entry`);
    }
    if (readPart(part, field, selected)) {
      restricted = true;
    }
  }

  return { values: [...selected].toSorted((a, b) => a - b), restricted };
}

/** Adds one comma-separated part, and says whether it restricted the field. */
function readPart(part: string, field: CronField, into: Set<number>): boolean {
  const [range, step] = splitStep(part, field);
  const { from, to, wildcard } = readRange(range, field);

  for (let value = from; value <= to; value += step) {
    into.add(value);
  }

  // A star on its own leaves the field open. A star with a step does not, and
  // neither does a range that happens to span the whole field.
  return !(wildcard && step === 1);
}

function splitStep(part: string, field: CronField): [string, number] {
  const slash = part.indexOf("/");
  if (slash === -1) {
    return [part, 1];
  }

  const stepText = part.slice(slash + 1);
  if (!WHOLE_NUMBER.test(stepText) || Number(stepText) < 1) {
    return fail(field.name, `"${part}" has a step that is not a whole number`);
  }
  return [part.slice(0, slash), Number(stepText)];
}

function readRange(
  range: string,
  field: CronField,
): { from: number; to: number; wildcard: boolean } {
  if (range === "*") {
    return { from: field.min, to: field.max, wildcard: true };
  }

  const dash = range.indexOf("-", 1);
  if (dash === -1) {
    const only = readValue(range, field);
    return { from: only, to: only, wildcard: false };
  }

  const from = readValue(range.slice(0, dash), field);
  const to = readValue(range.slice(dash + 1), field);
  if (from > to) {
    return fail(
      field.name,
      `"${range}" runs backwards. Cron ranges do not wrap, so write two entries separated by a comma`,
    );
  }
  return { from, to, wildcard: false };
}

function readValue(text: string, field: CronField): number {
  const named = field.names?.indexOf(text.toLowerCase());
  if (named !== undefined && named !== -1) {
    return named + field.min;
  }

  if (!WHOLE_NUMBER.test(text)) {
    const expected =
      field.names === undefined
        ? "a whole number"
        : `a ${field.name} name or number`;
    return fail(field.name, `"${text}" is not ${expected}`);
  }

  const value = Number(text);
  if (value < field.min || value > field.max) {
    return fail(
      field.name,
      `${value} is out of range for the ${field.name} field. Expected ${field.min} to ${field.max}`,
    );
  }
  return value;
}
