/** Checking the fields a constraint rule holds. */

/** A whole number of things, at least one. */
export function asCount(value: number, path: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(
      `${path} is not a count: ${value}. Expected a whole number of at ` +
        "least 1. A cap of 0 is `never()`, which says so plainly.",
    );
  }
  return value;
}

/**
 * A length of time, as an ISO 8601 duration.
 *
 * Refused when it comes to no time at all. A window that holds nothing and a
 * spacing that separates nothing are both quiet ways of writing a rule with no
 * effect, and a rule with no effect is written `always()`.
 */
export function asGap(value: string, path: string): string {
  let duration: Temporal.Duration;
  try {
    duration = Temporal.Duration.from(value);
  } catch {
    throw new RangeError(
      `${path} is not a length of time: "${value}". Expected an ISO 8601 ` +
        'duration such as "PT4H" or "P180D".',
    );
  }
  if (duration.blank) {
    throw new RangeError(`${path} is no time at all: "${value}".`);
  }
  if (duration.sign < 0) {
    throw new RangeError(`${path} runs backwards: "${value}".`);
  }
  return value;
}
