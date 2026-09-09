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
import { asDuration, type DurationInput } from "./duration-input.js";
import { DEFAULT_SEARCH_LIMIT, SearchLimitExceededError } from "./search.js";

/** An estimate contains an outcome that the query could not resolve. */
export class UnresolvedOutcomeError<V = unknown> extends RangeError {
  public readonly operation: string;
  public readonly outcome: V;
  public readonly within: string;
  public constructor(
    operation: string,
    outcome: V,
    within: DurationInput = DEFAULT_SEARCH_LIMIT,
  ) {
    const limit = asDuration(within).toString();
    super(
      `${operation} could not resolve outcome ${JSON.stringify(outcome)} within ${limit}. Widen \`within\` to include every outcome.`,
    );
    this.name = "UnresolvedOutcomeError";
    this.operation = operation;
    this.outcome = outcome;
    this.within = limit;
  }
}

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
  within: DurationInput = DEFAULT_SEARCH_LIMIT,
): Estimate<W> {
  return mapOutcomes(estimate, (value) => {
    let reached: W | undefined;
    try {
      reached = resolve(value);
    } catch (error) {
      if (error instanceof SearchLimitExceededError) {
        throw new UnresolvedOutcomeError(called, value, within);
      }
      throw error;
    }
    if (reached === undefined) {
      throw new UnresolvedOutcomeError(called, value, within);
    }
    return reached;
  });
}
