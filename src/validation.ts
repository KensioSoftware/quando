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
