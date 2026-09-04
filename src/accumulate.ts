import type { CascadeLike } from "./cascade.js";
import type { Context } from "./context.js";
import { duration } from "./interval.js";
import { resolve } from "./resolve.js";

/** The exact elapsed-time units accepted by accumulation queries. */
export const ELAPSED_UNITS = [
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
] as const;

/** An exact elapsed-time unit used to express an accumulated value. */
export type ElapsedUnit = (typeof ELAPSED_UNITS)[number];

/**
 * Adds each resolved value multiplied by how long it applies.
 *
 * A value of three that applies for eight hours contributes 24 when `unit` is
 * `"hour"`. Durations are elapsed time, so a day containing a clock change
 * contributes 23 or 25 hours.
 */
export function accumulate(
  source: CascadeLike<number>,
  context: Context,
  unit: ElapsedUnit,
): number {
  if (!(ELAPSED_UNITS as readonly string[]).includes(unit)) {
    throw new RangeError(
      `accumulate() needs an exact elapsed-time unit. Expected one of ${ELAPSED_UNITS.join(
        ", ",
      )}, but found "${unit}".`,
    );
  }
  if (context.to === undefined) {
    throw new RangeError(
      "accumulate() needs a window with an end: give the context a `to`.",
    );
  }

  let total = 0;
  for (const span of resolve(source, context)) {
    const length = duration(span);
    if (length !== undefined) {
      total += span.value * length.total(unit);
    }
  }
  return total;
}
