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

import type { Covers } from "./assigned.js";
import type { Rule } from "./rule.js";
import type { CascadeLike } from "./cascade.js";
import { uncertainValues } from "./resolve.js";
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
  constructor(
    query: string,
    from: Temporal.ZonedDateTime,
    reader = "uncertain()",
  ) {
    super(
      `${query} cannot answer for ${from.toPlainDateTime().toString()}: ` +
        `the rules stop being known before then. Use ${reader} to read ` +
        "where the answer runs out, or widen the horizon the rules declare.",
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
  // A cascade asks which value holds, and unknown there is a third state on
  // every span rather than a second bound on a set of times. `resolve` carries
  // it, and this reads it back the same way.
  if (!isRule(covers)) {
    const cascade: CascadeLike<unknown> =
      "cascade" in covers ? covers.cascade : covers;
    return unknownValueIn(cascade, context);
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
export function refuse(
  query: string,
  fog: Interval,
  context: Context,
  reader?: string,
): never {
  throw new BeyondHorizonError(query, fog.start ?? context.from, reader);
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

/**
 * The first stretch a cascade cannot settle a value for.
 *
 * `undefined` where every moment in the window has one answer, which includes
 * every cascade whose layers declare no horizon.
 */
export function unknownValueIn<V>(
  cascade: CascadeLike<V>,
  context: Context,
): Interval | undefined {
  const [span] = take(uncertainValues(cascade, context), 1);
  return span;
}

/** Whether a query is reading a rule or a cascade. */
function isRule<V>(covers: Covers<V>): covers is Rule {
  return (
    "type" in covers && covers.type !== "cascade" && !("cascade" in covers)
  );
}
