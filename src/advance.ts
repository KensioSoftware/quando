/**
 * Where you get to after an amount of time that only counts while something
 * holds.
 *
 * The question both of the libraries this evolves from were built around, and
 * the one that needs a search rather than a sweep. [query.ts](./query.ts) has
 * the other three, and re-exports this one so callers see one surface.
 */

import { type Covers, covered } from "./assigned.js";
import type { Context } from "./context.js";
import { refuse, unknownIn, upTo } from "./horizon-guard.js";
import { duration } from "./interval.js";
import { checkExactDuration } from "./query-validation.js";
import {
  boundSearch,
  SearchLimitExceededError,
  type Search,
} from "./search.js";

/** Zero, as the amount that is already arrived at. */
const NOTHING = Temporal.Duration.from({ seconds: 0 });

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
export function advanceBy<V>(
  from: Temporal.ZonedDateTime,
  amount: Temporal.Duration,
  options: { readonly during: Covers<V> } & Search &
    Omit<Context, "from" | "to">,
): Temporal.ZonedDateTime | undefined {
  checkExactDuration(amount);
  if (Temporal.Duration.compare(amount, NOTHING) < 0) {
    throw new RangeError(
      `advanceBy() cannot go backwards. Asked for ${amount.toString()}.`,
    );
  }
  if (Temporal.Duration.compare(amount, NOTHING) === 0) {
    return from;
  }

  const { during, within, complete: _complete, ...rest } = options;
  const window = boundSearch(
    { ...rest, from },
    within === undefined ? undefined : { within },
  );

  let remaining = amount;
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
    refuse("advanceBy()", fog, window.context);
  }
  if (arrived) {
    return reached;
  }

  if (window.automaticLimit !== undefined) {
    throw new SearchLimitExceededError("advanceBy()", window.automaticLimit);
  }
  return undefined;
}
