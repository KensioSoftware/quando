import { requireWindowEnd } from "./context.js";
/**
 * Asking a question, rather than reading the times something covers.
 *
 * `intervals` is the plumbing. These are what a caller actually wants: is it
 * open now, how much working time is in this window, when does it next open,
 * and — the one both of the libraries this evolves from were built around —
 * where do you get to after three hours that only count while it is open.
 *
 * Durations are exact elapsed time throughout. Three operating hours means
 * three real hours of opening, so a window spanning a clock change is measured
 * by how long it lasted rather than by what the clock said.
 */

import { type CoverageSource, covered } from "./assigned.js";
import type { Context, QueryWindow } from "./context.js";
import { asDuration } from "./duration-input.js";
import { duration, type Interval } from "./interval.js";
import { refuse, unknownIn, throughIntervalEnd } from "./horizon-guard.js";
import {
  DEFAULT_SEARCH_LIMIT,
  boundSearch,
  restartSearch,
  SearchLimitExceededError,
  type Search,
} from "./search.js";
import { take } from "./stream.js";

export {
  DEFAULT_SEARCH_LIMIT,
  SearchLimitExceededError,
  type Search,
} from "./search.js";

/**
 * Whether a rule, or a value a cascade assigns, covers an instant.
 *
 * Always terminates, whatever it is reading and whatever the context: it asks
 * about the smallest window there is, so nothing can walk far looking for an
 * answer.
 *
 * Throws {@link BeyondHorizonError} where the rules stop being known before
 * the instant asked about. A `false` from this is a `false` somebody has the
 * data for.
 */
export function isActiveAt<V>(
  covers: CoverageSource<V>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): boolean {
  const moment: Context = {
    ...context,
    from: at,
    to: at.add({ nanoseconds: 1 }),
  };
  if (take(covered(covers, moment), 1).length > 0) {
    return true;
  }
  const fog = unknownIn(covers, moment);
  return fog === undefined ? false : refuse("isActiveAt()", fog, moment);
}

/**
 * How much time a rule, or a value a cascade assigns, covers within a window.
 *
 * Needs a window with an end, because the alternative is a number that never
 * finishes being counted.
 *
 * The whole window is counted, so any part of it the rules cannot answer for
 * makes the total unknown and throws {@link BeyondHorizonError}.
 */
export function coveredDuration<V>(
  covers: CoverageSource<V>,
  context: QueryWindow,
): Temporal.Duration {
  requireWindowEnd(
    context,
    "coveredDuration() needs a window with an end: give the context a `to`.",
  );

  const fog = unknownIn(covers, context);
  if (fog !== undefined) {
    refuse("coveredDuration()", fog, context);
  }

  let total = asDuration({ seconds: 0 });
  for (const interval of covered(covers, context)) {
    const length = duration(interval);
    if (length !== undefined) {
      total = total.add(length);
    }
  }
  return total.round({ largestUnit: "hour" });
}

/**
 * The next stretch of time covered, at or after the context's start.
 *
 * `undefined` when there is none within the search. If time is being covered
 * already at the context's start, that stretch is returned clipped to begin
 * there — "when does it next open" answers "it is open" rather than skipping
 * to tomorrow.
 *
 * Unknown coverage before or within the result throws
 * {@link BeyondHorizonError}. A complete end must also be known.
 */
export function nextCoveredInterval<V>(
  covers: CoverageSource<V>,
  context: Context,
  search?: Search,
): Interval | undefined {
  const window = boundSearch(context, search);
  const [first] = take(covered(covers, window.context), 1);

  const fog = unknownIn(covers, throughIntervalEnd(window.context, first?.end));
  if (fog !== undefined) {
    refuse("nextCoveredInterval()", fog, window.context);
  }

  if (first === undefined) {
    if (window.automaticLimit !== undefined) {
      throw new SearchLimitExceededError(
        "nextCoveredInterval()",
        window.automaticLimit,
      );
    }
    return;
  }
  if (search?.intervalEnd !== "complete" || first.start === undefined) {
    return first;
  }
  const limit = asDuration(search.endWithin ?? DEFAULT_SEARCH_LIMIT);
  const endSearch = boundSearch(restartSearch(context, first.start), {
    within: limit,
  });
  const [whole] = take(covered(covers, endSearch.context), 1);
  const unknown = unknownIn(
    covers,
    throughIntervalEnd(endSearch.context, whole?.end),
  );
  if (unknown !== undefined) {
    refuse("nextCoveredInterval()", unknown, endSearch.context);
  }
  if (
    whole?.end?.equals(endSearch.context.to) === true &&
    isActiveAt(covers, endSearch.context.to, context)
  ) {
    throw new SearchLimitExceededError(
      "nextCoveredInterval() interval end",
      limit,
    );
  }
  return whole ?? first;
}

export { addCoveredTime } from "./advance.js";
