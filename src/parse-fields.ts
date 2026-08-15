/**
 * Checking one field of an incoming rule document.
 *
 * Each of these either returns the value at the type it claims to be, or
 * throws saying what was found instead and where. The `path` threaded through
 * them is what turns "not a date" into
 * `rule.rules[1].rules[0].dates[0]: "not a date" is not a date`.
 */

import { WEEKDAYS, type Weekday } from "./rule.js";

const WEEKDAY_NAMES = new Set<string>(WEEKDAYS);

export function fail(path: string, problem: string): never {
  throw new TypeError(`${path}: ${problem}`);
}

/** What a value looks like, for an error message. */
export function shapeOf(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "an array";
  }
  return typeof value;
}

export function asRecord(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(path, `expected a rule object, found ${shapeOf(value)}`);
  }
  return value as Record<string, unknown>;
}

export function asString(value: unknown, path: string): string {
  return typeof value === "string"
    ? value
    : fail(path, `expected a string, found ${shapeOf(value)}`);
}

export function asStrings(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    return fail(path, `expected an array, found ${shapeOf(value)}`);
  }
  return value.map((item, index) =>
    typeof item === "string"
      ? item
      : fail(`${path}[${index}]`, `expected a string, found ${shapeOf(item)}`),
  );
}

export function asDays(value: unknown, path: string): Weekday[] {
  return asStrings(value, path).map((day, index) =>
    WEEKDAY_NAMES.has(day)
      ? (day as Weekday)
      : fail(
          `${path}[${index}]`,
          `"${day}" is not a day of the week. Expected one of ${WEEKDAYS.join(", ")}`,
        ),
  );
}

/** Checked by construction, so a malformed time is caught where it is written. */
export function asTime(value: unknown, path: string): string {
  const time = asString(value, path);
  try {
    Temporal.PlainTime.from(time);
  } catch {
    return fail(
      path,
      `"${time}" is not a time of day. Expected something like "09:00"`,
    );
  }
  return time;
}

export function asDates(value: unknown, path: string): string[] {
  return asStrings(value, path).map((date, index) => {
    try {
      Temporal.PlainDate.from(date);
    } catch {
      return fail(
        `${path}[${index}]`,
        `"${date}" is not a date. Expected something like "2026-03-14"`,
      );
    }
    return date;
  });
}

/**
 * A zone is checked here rather than left to fail at query time, because a
 * mistyped one in a stored rule should be a problem when the rule is read, not
 * hours later when something asks a question of it.
 */
export function asZone(value: unknown, path: string): string {
  const zone = asString(value, path);
  try {
    Temporal.PlainDate.from("2000-01-01").toZonedDateTime({
      timeZone: zone,
      plainTime: "00:00",
    });
  } catch {
    return fail(path, `"${zone}" is not a known time zone`);
  }
  return zone;
}

/** Present or absent, never present-and-undefined. */
export function zonePart(
  node: Record<string, unknown>,
  path: string,
): { zone?: string } {
  const zone = node["zone"];
  return zone === undefined ? {} : { zone: asZone(zone, `${path}.zone`) };
}
