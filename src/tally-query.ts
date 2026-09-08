import { accumulate, type ElapsedUnit } from "./accumulate.js";
import type { Cascade } from "./cascade.js";
import type { Context } from "./context.js";
import { valueAt } from "./assigned.js";
import { explainTally } from "./explain.js";
import { duration } from "./interval.js";
import { resolve } from "./resolve.js";
import { validate } from "./semantic-validation.js";
import type { Tally } from "./tally-types.js";
import { checkWindow } from "./validation.js";

/**
 * The current query names. `at` is a deprecated alias for `countAt` and stays
 * in [tally.ts](./tally.ts), so nothing here has to name it.
 */
type TallyQueries = Pick<
  Tally,
  "countAt" | "explain" | "least" | "totalBetween" | "counts" | "validate"
>;

/**
 * Creates the query methods restored onto a tally.
 *
 * `read` is what the tally carries beside its window: the registry a `custom`
 * rule in one of its scopes is looked up in. Every query builds its own
 * window, so each spreads `read` into the context it makes.
 */
export function tallyQueries(
  document: Cascade<number>,
  read?: Omit<Context, "from" | "to">,
): TallyQueries {
  return {
    countAt: (at) => countAt(document, at, read),
    explain: (at) => explainTally(document, at, read),
    least: (from, to) => leastValue(document, from, to, read),
    totalBetween: (from, to, unit: ElapsedUnit) =>
      accumulate(document, { ...read, from, to }, unit),
    counts: (from, to) =>
      resolve(
        document,
        to === undefined ? { ...read, from } : { ...read, from, to },
      ),
    validate: (from, to) => validate(document, { ...read, from, to }),
  };
}

const ZERO_DURATION = Temporal.Duration.from({ seconds: 0 });

/** Returns the tally count at one instant. */
export function countAt(
  document: Cascade<number>,
  at: Temporal.ZonedDateTime,
  read?: Omit<Context, "from" | "to">,
): number {
  return valueAt(document, at, read) ?? 0;
}

/** Finds the lowest tally value across a complete time window. */
export function leastValue(
  document: Cascade<number>,
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime,
  read?: Omit<Context, "from" | "to">,
): number {
  checkWindow(from, to);
  let lowest: number | undefined;
  let covered = ZERO_DURATION;
  for (const span of resolve(document, { ...read, from, to })) {
    lowest = lowest === undefined ? span.value : Math.min(lowest, span.value);
    const length = duration(span);
    if (length !== undefined) {
      covered = covered.add(length);
    }
  }
  const window = from.until(to, { largestUnit: "hour" });
  return Temporal.Duration.compare(covered, window) < 0 ? 0 : (lowest ?? 0);
}
