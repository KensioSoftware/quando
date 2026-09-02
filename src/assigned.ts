/**
 * Asking the four questions of a cascade rather than of a rule.
 *
 * `activeAt`, `elapsed`, `next` and `advanceBy` are about *when*, and a rule
 * is what they read. A cascade says *what holds when*, which is a different
 * question. Narrowing one to a single value turns it back into the first.
 * The times a rota assigns to Alice are a stretch of when, and every question
 * worth asking about a rule is worth asking about them.
 *
 * So {@link assigned} is what the queries take in place of a rule, and
 * {@link valueAt} is the one question a rule has no version of.
 */

import type { Cascade, Valued } from "./cascade.js";
import type { Context } from "./context.js";
import type { IntervalStream } from "./interval-stream.js";
import { intervals } from "./interpret.js";
import { resolve } from "./resolve.js";
import type { Rule } from "./rule.js";
import { take } from "./stream.js";

/**
 * A cascade narrowed to the times it assigns one value.
 *
 * Not a rule, and deliberately not made to look like one. A rule is a document
 * that stores and travels, and this is a question asked at the point of
 * asking. Building one costs nothing and evaluates nothing.
 */
export interface Assigned<V> {
  readonly cascade: Cascade<V>;
  readonly is: V;
}

/** Either of the two things a query can read as the times it covers. */
export type Covers<V> = Rule | Assigned<V>;

/**
 * The times a cascade assigns a value.
 *
 * ```ts
 * elapsed(assigned(onCall, "alice"), week);
 * advanceBy(from, threeHours, { during: assigned(onCall, "alice") });
 * ```
 *
 * Sameness is `Object.is`, the same test {@link coalesce} uses, so a value
 * matches by identity rather than by shape.
 */
export function assigned<V>(cascade: Cascade<V>, is: V): Assigned<V> {
  return { cascade, is };
}

/** Whether a query is reading a rule or a narrowed cascade. */
function isRule<V>(covers: Covers<V>): covers is Rule {
  return "type" in covers;
}

/**
 * The times something covers, whichever of the two it is.
 *
 * This is the one place the queries have to know that a cascade exists, and
 * what comes back either way is an ordinary interval stream, so everything
 * above it stays written once.
 */
export function covered<V>(
  covers: Covers<V>,
  context: Context,
): IntervalStream {
  if (isRule(covers)) {
    return intervals(covers, context);
  }
  return matching(covers, context);
}

/** The stretches of a resolved cascade carrying the value asked for. */
function* matching<V>(covers: Assigned<V>, context: Context): IntervalStream {
  for (const span of resolve(covers.cascade, context)) {
    if (Object.is(span.value, covers.is)) {
      yield { start: span.start, end: span.end };
    }
  }
}

/**
 * What a cascade assigns at an instant, or `undefined` where nothing does.
 *
 * The question a rule has no version of. `activeAt` asks whether a rule covers
 * a moment, and the answer for a cascade is not whether but what.
 *
 * Always terminates, whatever the layers say, because it asks about the
 * smallest window there is.
 */
export function valueAt<V>(
  cascade: Cascade<V>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): V | undefined {
  const moment: Context = {
    ...context,
    from: at,
    to: at.add({ nanoseconds: 1 }),
  };
  const [now] = take(resolve(cascade, moment), 1);
  return now?.value;
}

/**
 * The next stretch a cascade assigns anything at all, with its value.
 *
 * `next` narrowed to one value answers "when is Alice next on". This answers
 * "what happens next", whatever that turns out to be, which is the question a
 * timeline asks.
 */
export function nextValue<V>(
  cascade: Cascade<V>,
  context: Context,
): Valued<V> | undefined {
  const [first] = take(resolve(cascade, context), 1);
  return first;
}
