/**
 * The value at a moment nobody has the data for.
 *
 * A rule answers whether a time is covered, so unknown there is a second bound
 * on a set of times and [bounds.ts](./bounds.ts) carries it. A cascade answers
 * *which value* holds, and unknown there is a third state on every span.
 *
 * It is carried through the fold as an ordinary value. That is what makes it
 * cheap, and it is what makes `override` exact without a line of its own: the
 * later layer wins, so an unknown layer on top leaves the answer unknown, and
 * a layer that definitely applies displaces an unknown underneath it. A fogged
 * layer below one that certainly covers the moment cannot change the answer,
 * and does not.
 *
 * The arithmetic merges have no such luck. Every layer contributes to a sum,
 * so one contribution nobody can vouch for makes the total unknown.
 */

import { type Merge, type MergeStrategy, mergeBy } from "./merge.js";

/** The value of a moment the layers cannot settle. */
export const UNKNOWN: unique symbol = Symbol("unknown");

/** A value, or the fact that nobody knows which one it is. */
export type Uncertain<V> = V | typeof UNKNOWN;

/** Whether a resolved value is one somebody has the data for. */
export function isKnown<V>(value: Uncertain<V>): value is V {
  return value !== UNKNOWN;
}

/**
 * The merge a strategy stands for, taught what to do with an unknown.
 *
 * `override` needs nothing. It keeps the later value whatever either side is,
 * which is already the right answer both ways round.
 */
export function uncertainMerge<V>(
  strategy: MergeStrategy | undefined,
): Merge<Uncertain<V>> {
  if (strategy === undefined || strategy === "override") {
    return (_under, over) => over;
  }

  const merge = mergeBy<V>(strategy);
  return (under, over) =>
    isKnown(under) && isKnown(over) ? merge(under, over) : UNKNOWN;
}
