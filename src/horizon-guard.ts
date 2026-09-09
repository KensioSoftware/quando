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

import type { CoverageSource } from "./assigned.js";
import type { RuleData } from "./rule.js";
import type { CascadeLike } from "./cascade.js";
import { unknownValueIntervals } from "./resolve.js";
import { unknownIntervals } from "./bounds.js";
import type { Context, QueryWindow } from "./context.js";
import { evaluationOptions } from "./evaluation-options.js";
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
    reader = "unknownIntervals()",
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
  covers: CoverageSource<V>,
  context: Context,
): Interval | undefined {
  const read = evaluationOptions(covers, context);
  // A cascade asks which value holds, and unknown there is a third state on
  // every span rather than a second bound on a set of times. `resolve` carries
  // it, and this reads it back the same way.
  if (!isRule(covers)) {
    const cascade: CascadeLike<unknown> =
      "cascade" in covers ? covers.cascade : covers;
    return unknownValueIn(cascade, read);
  }
  if (!hasHorizon(covers, read.rules)) {
    return undefined;
  }
  const [first] = take(unknownIntervals(covers, read), 1);
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

/** Includes an interval's end when it claims to end before the search does. */
export function throughIntervalEnd(
  context: QueryWindow,
  end: Temporal.ZonedDateTime | undefined,
): QueryWindow {
  if (
    end === undefined ||
    Temporal.ZonedDateTime.compare(end, context.to) >= 0
  ) {
    return context;
  }
  return { ...context, to: end.add({ nanoseconds: 1 }) };
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
  const [span] = take(unknownValueIntervals(cascade, context), 1);
  return span;
}

/** Whether a query is reading a rule or a cascade. */
function isRule<V>(covers: CoverageSource<V>): covers is RuleData {
  return (
    "type" in covers && covers.type !== "cascade" && !("cascade" in covers)
  );
}
