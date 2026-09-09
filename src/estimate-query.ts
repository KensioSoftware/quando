/**
 * Running a query once per outcome, which is what makes an estimate useful.
 *
 * The queries that advance through a rule set take one amount and answer with
 * one instant. Given an estimate they run once per outcome, and
 * [estimate-outcomes.ts](./estimate-outcomes.ts) accumulates the probability
 * on whatever each one lands on.
 */

import type { Estimate } from "./estimate.js";
import { mapOutcomes } from "./estimate-outcomes.js";

/**
 * An estimate mapped through a query that can fail to find an answer.
 *
 * An outcome the search never reaches is refused rather than dropped. A
 * distribution missing part of its mass reads as a distribution, and every
 * quantile taken from it would be wrong by however much went missing.
 */
export function resolvedOutcomes<V, W>(
  estimate: Estimate<V>,
  called: string,
  resolve: (value: V) => W | undefined,
): Estimate<W> {
  return mapOutcomes(estimate, (value) => {
    const reached = resolve(value);
    if (reached === undefined) {
      throw new RangeError(
        `${called} ran out of search before reaching the outcome ` +
          `${String(value)}. Dropping it would take that much probability ` +
          "out of the answer without saying so. Widen `within`.",
      );
    }
    return reached;
  });
}
