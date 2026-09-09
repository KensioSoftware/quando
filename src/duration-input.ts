/** An elapsed or calendar duration supplied to a public API. */
export type DurationInput = Temporal.Duration | Temporal.DurationLike | string;

/** Normalizes a duration at the public API boundary. */
export function asDuration(value: DurationInput): Temporal.Duration {
  if (Object.getOwnPropertyDescriptor(globalThis, "Temporal") === undefined) {
    throw new Error(
      "Quando needs Temporal. Install temporal-polyfill and import temporal-polyfill/global before evaluating rules.",
    );
  }
  try {
    return Temporal.Duration.from(value);
  } catch {
    throw new RangeError('Expected a duration such as "PT4H" or { hours: 4 }.');
  }
}
