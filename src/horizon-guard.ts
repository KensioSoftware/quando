/**
 * Refusing a query whose answer would depend on time nobody has the data for.
 *
 * The queries keep the signatures and the meanings they have always had. What
 * changes is that a rule declaring a horizon can now make one of them refuse
 * instead of guessing, and it refuses narrowly: the check is whether the fog
 * reaches the part of the window the answer actually rests on. A Saturday past
 * the end of a holiday list is still confidently closed.
 *
 * Everything here is free for a rule with no horizon in it. The first thing
 * each function does is ask, and the answer is no for every rule written
 * before horizons existed.
 */

import { covered, type Covers, isRule } from "./assigned.js";
import { uncertain } from "./bounds.js";
import type { Context } from "./context.js";
import { hasHorizon } from "./horizon-shape.js";
import type { Interval } from "./interval.js";
import { take } from "./stream.js";

/**
 * A query whose answer depends on time nobody has the data for.
 *
 * Thrown rather than answered, for the same reason
 * {@link MissingOccurrencesError} is thrown rather than reporting a fifth dose
 * as fine. Where the missing data cannot change the answer, no error is
 * raised: a Saturday past the horizon of a holiday list is still closed.
 */
export class BeyondHorizonError extends Error {
  constructor(query: string, from: Temporal.ZonedDateTime) {
    super(
      `${query} cannot answer for ${from.toPlainDateTime().toString()}: ` +
        "the rules stop being known before then. " +
        "Use uncertain() to read where the answer runs out, or widen the " +
        "horizon the rules declare.",
    );
    this.name = "BeyondHorizonError";
  }
}

/**
 * The first stretch within a window that the rules cannot answer for.
 *
 * `undefined` where the whole window is known, which includes every rule that
 * declares no horizon.
 */
export function unknownIn<V>(
  covers: Covers<V>,
  context: Context,
): Interval | undefined {
  // A cascade is refused by `resolve`, which every valued question goes
  // through, so by the time a query reads one there is nothing left to check.
  if (!isRule(covers)) {
    return undefined;
  }
  if (!hasHorizon(covers, context.rules)) {
    return undefined;
  }
  const [first] = take(uncertain(covers, context), 1);
  return first;
}

/**
 * Refuses a query, naming where its answer ran out.
 *
 * Called by a query that has found fog in the part of the window its answer
 * depends on.
 */
export function refuse(query: string, fog: Interval, context: Context): never {
  throw new BeyondHorizonError(query, fog.start ?? context.from);
}

/**
 * The same window, cut short where an answer stops depending on it.
 *
 * `nextCoveredInterval` rests on the time up to the stretch it found, and
 * nothing after that can change what it returns. Narrowing the window before
 * looking for fog is what keeps the refusal narrow.
 *
 * The instant comes from an interval that was already clipped to the window,
 * so it never reaches past the end and there is no minimum to take.
 */
export function upTo(
  context: Context,
  at: Temporal.ZonedDateTime | undefined,
): Context {
  return at === undefined ? context : { ...context, to: at };
}

/** Whether a rule certainly covers an instant, or is not known to. */
export type Certainty = "covered" | "uncovered" | "unknown";

/**
 * Whether a rule covers an instant, and whether that answer is known.
 *
 * What an explanation reads. A query refuses where this says `unknown`, and an
 * explanation reports it, because the job of an explanation is to say what the
 * state is rather than to act on it.
 */
export function certaintyAt<V>(
  covers: Covers<V>,
  at: Temporal.ZonedDateTime,
  context: Omit<Context, "from" | "to"> | undefined,
): Certainty {
  const moment: Context = {
    ...context,
    from: at,
    to: at.add({ nanoseconds: 1 }),
  };
  if (take(covered(covers, moment), 1).length > 0) {
    return "covered";
  }
  return unknownIn(covers, moment) === undefined ? "uncovered" : "unknown";
}
