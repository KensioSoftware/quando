export { valueAt, nextValueInterval } from "./value-query.js";
/**
 * Asking the four questions of a cascade rather than of a rule.
 *
 * `isActiveAt`, `coveredDuration`, `nextCoveredInterval` and `addCoveredTime` are
 * about *when*, and a rule is what they read. A cascade says *what holds when*,
 * which is a different question. Narrowing one to a single value turns it back
 * into the first.
 * The times a rota assigns to Alice are a stretch of when, and every question
 * worth asking about a rule is worth asking about them.
 *
 * So {@link assigned} is what the queries take in place of a rule, and
 * {@link valueAt} is the one question a rule has no version of.
 */

import { asCascade, type Cascade, type CascadeLike } from "./cascade.js";
import type { Context } from "./context.js";
import {
  evaluationOptions,
  withEvaluationOptions,
} from "./evaluation-options.js";
import { bounds } from "./bounds.js";
import type { IntervalStream } from "./interval-stream.js";
import { resolve } from "./resolve.js";
import type { RuleData } from "./rule.js";

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
export type CoverageSource<V = unknown> =
  | RuleData
  | Assigned<V>
  | ValueSelection<V>
  | CascadeLike<boolean>;

/** A value predicate applied to a resolved cascade. */
export interface ValueSelection<V> {
  readonly cascade: Cascade<V>;
  readonly matches: (value: V) => boolean;
}

/** Selects the intervals whose assigned value satisfies a predicate. */
export function whereValueMatches<V>(
  source: CascadeLike<V>,
  matches: (value: V) => boolean,
): ValueSelection<V> {
  return withEvaluationOptions(
    { cascade: asCascade(source), matches },
    evaluationOptions(source, {}),
  );
}

/**
 * The times a cascade assigns a value.
 *
 * ```ts
 * coveredDuration(assigned(onCall, "alice"), week);
 * addCoveredTime(from, threeHours, { during: assigned(onCall, "alice") });
 * ```
 *
 * Sameness is `Object.is`, the same test {@link coalesce} uses, so a value
 * matches by identity rather than by shape.
 */
export function assigned<V>(cascade: CascadeLike<V>, is: V): Assigned<V> {
  return withEvaluationOptions(
    { cascade: asCascade(cascade), is },
    evaluationOptions(cascade, {}),
  );
}

/** Whether a query is reading a rule or a narrowed cascade. */
export function isRule<V>(covers: CoverageSource<V>): covers is RuleData {
  return (
    "type" in covers && covers.type !== "cascade" && !("cascade" in covers)
  );
}

/**
 * The times something covers, whichever of the two it is.
 *
 * This is the one place the queries have to know that a cascade exists, and
 * what comes back either way is an ordinary interval stream, so everything
 * above it stays written once.
 *
 * The times a rule *certainly* covers, which for every rule that declares no
 * horizon is every time it covers. See [bounds.ts](./bounds.ts).
 */
export function covered<V>(
  covers: CoverageSource<V>,
  context: Context,
): IntervalStream {
  const read = evaluationOptions(covers, context);
  if (isRule(covers)) {
    return bounds(covers, read).certain;
  }
  if ("is" in covers || "matches" in covers) {
    return matching(covers, read);
  }
  return matching({ cascade: asCascade(covers), is: true }, read);
}

/** The stretches of a resolved cascade carrying the value asked for. */
function* matching<V>(
  covers: Assigned<V> | ValueSelection<V>,
  context: Context,
): IntervalStream {
  for (const span of resolve(covers.cascade, context)) {
    if (
      "matches" in covers
        ? covers.matches(span.value)
        : Object.is(span.value, covers.is)
    ) {
      yield { start: span.start, end: span.end };
    }
  }
}
