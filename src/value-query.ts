import type { CascadeLike, ValueInterval } from "./cascade.js";
import type { Context } from "./context.js";
import { evaluationOptions } from "./evaluation-options.js";
import {
  boundSearch,
  SearchLimitExceededError,
  type Search,
} from "./search.js";
import { refuse, unknownValueIn, throughIntervalEnd } from "./horizon-guard.js";
import { resolve } from "./resolve.js";
import { take } from "./stream.js";

/**
 * What a cascade assigns at an instant, or `undefined` where nothing does.
 *
 * Always terminates, whatever the layers say, because it asks about the
 * smallest window there is.
 *
 * Throws {@link BeyondHorizonError} where the layers cannot settle which value
 * holds. An `undefined` from this means no layer claims the moment, and never
 * that one might have.
 */
export function valueAt<V>(
  cascade: CascadeLike<V>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): V | undefined {
  const moment: Context = {
    ...evaluationOptions(cascade, context ?? {}),
    from: at,
    to: at.add({ nanoseconds: 1 }),
  };
  const [now] = take(resolve(cascade, moment), 1);
  if (now !== undefined) {
    return now.value;
  }
  const fog = unknownValueIn(cascade, moment);
  return fog === undefined
    ? undefined
    : refuse("valueAt()", fog, moment, "unknownValueIntervals()");
}

/**
 * The current or next assigned interval, clipped to the bounded search.
 * Unknown coverage before or within the result makes the answer unknown.
 */
export function nextValueInterval<V>(
  cascade: CascadeLike<V>,
  context: Context,
  search?: Pick<Search, "within">,
): ValueInterval<V> | undefined {
  const window = boundSearch(evaluationOptions(cascade, context), search);
  const [first] = take(resolve(cascade, window.context), 1);
  const fog = unknownValueIn(
    cascade,
    throughIntervalEnd(window.context, first?.end),
  );
  if (fog !== undefined) {
    refuse("nextValueInterval()", fog, context, "unknownValueIntervals()");
  }
  if (first === undefined && window.automaticLimit !== undefined) {
    throw new SearchLimitExceededError(
      "nextValueInterval()",
      window.automaticLimit,
    );
  }
  return first;
}
