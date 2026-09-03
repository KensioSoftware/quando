import type { Cascade } from "./cascade.js";
import { duration } from "./interval.js";
import { resolve } from "./resolve.js";
import { checkWindow } from "./validation.js";

const ZERO_DURATION = Temporal.Duration.from({ seconds: 0 });

/** Finds the lowest tally value across a complete time window. */
export function leastValue(
  document: Cascade<number>,
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime,
): number {
  checkWindow(from, to);
  let lowest: number | undefined;
  let covered = ZERO_DURATION;
  for (const span of resolve(document, { from, to })) {
    lowest = lowest === undefined ? span.value : Math.min(lowest, span.value);
    const length = duration(span);
    if (length !== undefined) {
      covered = covered.add(length);
    }
  }
  const window = from.until(to, { largestUnit: "hour" });
  return Temporal.Duration.compare(covered, window) < 0 ? 0 : (lowest ?? 0);
}
