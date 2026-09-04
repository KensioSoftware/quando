/**
 * Checking the numeric fields of an incoming rule document.
 *
 * A day of the month, an occurrence within one, how many periods a recurrence
 * steps through. Each has its own range and its own reason for refusing zero,
 * and each says what it wanted rather than only that the value was wrong.
 *
 * [parse-fields.ts](./parse-fields.ts) has the fields that are names and
 * timestamps, and [parse-shape.ts](./parse-shape.ts) the ones underneath that
 * know nothing about time at all.
 */

import { fail, shapeOf } from "./parse-shape.js";

export function asMonthDays(value: unknown, path: string): number[] {
  if (!Array.isArray(value)) {
    return fail(path, `expected an array, found ${shapeOf(value)}`);
  }
  return value.map((day, index) => {
    const at = `${path}[${index}]`;
    if (typeof day !== "number") {
      return fail(at, `expected a number, found ${shapeOf(day)}`);
    }
    if (!Number.isInteger(day) || day === 0 || day < -31 || day > 31) {
      return fail(
        at,
        `${day} is not a day of the month. Expected 1 to 31, or -1 to -31 counting back from the end`,
      );
    }
    return day;
  });
}

export function asInterval(value: unknown, path: string): number {
  if (typeof value !== "number") {
    return fail(path, `expected a number, found ${shapeOf(value)}`);
  }
  if (!Number.isInteger(value) || value < 1) {
    return fail(path, `${value} is not an interval. Expected 1 or more`);
  }
  return value;
}

export function asNth(value: unknown, path: string): number {
  if (typeof value !== "number") {
    return fail(path, `expected a number, found ${shapeOf(value)}`);
  }
  if (!Number.isInteger(value) || value === 0 || value < -5 || value > 5) {
    return fail(
      path,
      `${value} is not an occurrence in a month. Expected 1 to 5, or -1 to -5 counting back from the end`,
    );
  }
  return value;
}
