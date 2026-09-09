/**
 * Where you get to after an amount of time that only counts while something
 * holds.
 *
 * The question both of the libraries this evolves from were built around, and
 * the one that needs a search rather than a sweep. [query.ts](./query.ts) has
 * the other three, and re-exports this one so callers see one surface.
 */

import { type CoverageSource, covered } from "./assigned.js";
import type { Context } from "./context.js";
import { asDuration, type DurationInput } from "./duration-input.js";
import type { Distribution, Estimate, Possibilities } from "./estimate.js";
import { resolvedOutcomes } from "./estimate-query.js";
import { refuse, unknownIn, upTo } from "./horizon-guard.js";
import { duration } from "./interval.js";
import { checkExactDuration } from "./query-validation.js";
import {
  boundSearch,
  SearchLimitExceededError,
  type Search,
} from "./search.js";

/** What {@link addCoveredTime} reads, and how far it looks for an answer. */
export type AdvanceOptions<V = unknown> = {
  readonly during: CoverageSource<V>;
} & Search &
  Omit<Context, "from" | "to">;

/**
 * Where you get to after an amount of time that only counts while something
 * holds.
 *
 * Three operating hours from an order placed at five to five on a Friday is
 * some way into Monday morning, and this is the function that says where.
 * `undefined` when the search runs out before the time does.
 *
 * The answer rests on the time between the start and the instant reached, so
 * anything unknown in there throws {@link BeyondHorizonError}.
 */
export function addCoveredTime<V>(
  from: Temporal.ZonedDateTime,
  amount: DurationInput,
  options: AdvanceOptions<V>,
): Temporal.ZonedDateTime | undefined;
export function addCoveredTime<V>(
  from: Temporal.ZonedDateTime,
  amount: Possibilities<DurationInput>,
  options: AdvanceOptions<V>,
): Possibilities<Temporal.ZonedDateTime>;
export function addCoveredTime<V>(
  from: Temporal.ZonedDateTime,
  amount: Distribution<DurationInput>,
  options: AdvanceOptions<V>,
): Distribution<Temporal.ZonedDateTime>;
export function addCoveredTime<V>(
  from: Temporal.ZonedDateTime,
  amount: Estimate<DurationInput>,
  options: AdvanceOptions<V>,
): Estimate<Temporal.ZonedDateTime>;
export function addCoveredTime<V>(
  from: Temporal.ZonedDateTime,
  amount: Estimate<DurationInput> | DurationInput,
  options: AdvanceOptions<V>,
): Estimate<Temporal.ZonedDateTime> | Temporal.ZonedDateTime | undefined;
export function addCoveredTime<V>(
  from: Temporal.ZonedDateTime,
  amount: Estimate<DurationInput> | DurationInput,
  options: AdvanceOptions<V>,
): Estimate<Temporal.ZonedDateTime> | Temporal.ZonedDateTime | undefined {
  if (typeof amount === "object" && "kind" in amount) {
    return resolvedOutcomes(
      amount,
      "addCoveredTime()",
      (one) => addCoveredTime(from, one, options),
      options.within,
    );
  }

  const elapsed = asDuration(amount);
  checkExactDuration(elapsed);
  if (elapsed.sign < 0) {
    throw new RangeError(
      `addCoveredTime() cannot go backwards. Asked for ${elapsed.toString()}.`,
    );
  }
  if (elapsed.sign === 0) {
    return from;
  }

  const { during, ...rest } = options;
  const window = boundSearch({ ...rest, from }, options);

  let remaining = elapsed;
  let arrived = false;
  let reached: Temporal.ZonedDateTime | undefined;
  for (const interval of covered(during, window.context)) {
    const length = duration(interval);

    // An interval with no end has more than enough of whatever is left.
    if (
      length === undefined ||
      Temporal.Duration.compare(length, remaining) >= 0
    ) {
      reached = interval.start?.add(remaining);
      arrived = true;
      break;
    }

    remaining = remaining.subtract(length);
  }

  const fog = unknownIn(during, upTo(window.context, reached));
  if (fog !== undefined) {
    refuse("addCoveredTime()", fog, window.context);
  }
  if (arrived) {
    return reached;
  }

  if (window.automaticLimit !== undefined) {
    throw new SearchLimitExceededError(
      "addCoveredTime()",
      window.automaticLimit,
    );
  }
  return undefined;
}
