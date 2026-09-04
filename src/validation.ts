import { MONTHS, type Month, WEEKDAYS, type Weekday } from "./rule.js";

/** Reads and validates a day of the week. */
export function asWeekday(value: string, path: string): Weekday {
  if (!WEEKDAYS.includes(value as Weekday)) {
    throw new RangeError(
      `${path} is not a weekday: "${value}". Expected one of ${WEEKDAYS.join(", ")}.`,
    );
  }
  return value as Weekday;
}

/** Reads and validates a month of the year. */
export function asMonth(value: string, path: string): Month {
  if (!MONTHS.includes(value as Month)) {
    throw new RangeError(
      `${path} is not a month: "${value}". Expected one of ${MONTHS.join(", ")}.`,
    );
  }
  return value as Month;
}

/**
 * Reads and validates a day of the month, counting from either end.
 *
 * Zero is rejected rather than treated as one, because a caller who writes it
 * has an off-by-one somewhere and the quiet reading would hide it.
 */
export function asDayOfMonth(value: number, path: string): number {
  if (!Number.isInteger(value) || value === 0 || value < -31 || value > 31) {
    throw new RangeError(
      `${path} is not a day of the month: ${value}. Expected 1 to 31, or -1 to -31 counting back from the end.`,
    );
  }
  return value;
}

/** Reads and normalises a wall-clock time. */
export function asTime(value: string, path: string): string {
  try {
    Temporal.PlainTime.from(value);
    return value;
  } catch {
    throw new RangeError(`${path} is not a time of day: "${value}".`);
  }
}

/** Reads and normalises a calendar date. */
export function asDate(value: string, path: string): string {
  try {
    Temporal.PlainDate.from(value);
    return value;
  } catch {
    throw new RangeError(`${path} is not a date: "${value}".`);
  }
}

/** Checks that the runtime recognises a time zone. */
export function asZone(value: string, path: string): string {
  try {
    Temporal.ZonedDateTime.from(`2000-01-01T00:00[${value}]`);
    return value;
  } catch {
    throw new RangeError(`${path} is not a known time zone: "${value}".`);
  }
}

/** Checks an evaluation window before a stream starts. */
export function checkWindow(
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime | undefined,
): void {
  if (to !== undefined && Temporal.ZonedDateTime.compare(from, to) > 0) {
    throw new RangeError("The context's `to` must be at or after its `from`.");
  }
}
