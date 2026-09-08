/**
 * The pieces the two bounds are built out of.
 *
 * A horizon laid over a subtree, a leaf read the one way, and the two folds.
 * [bounds-algebra.ts](./bounds-algebra.ts) is what walks the rule language and
 * calls these. They live apart from it because none of them recurse, and the
 * walk is easier to read with them out of the way.
 */

import type { Bounds } from "./bounds.js";
import type { Context } from "./context.js";
import { customHorizonAt } from "./horizon.js";
import { intervals } from "./interpret.js";
import type { Interval } from "./interval.js";
import {
  clip,
  intersect,
  type IntervalStream,
  union,
} from "./interval-stream.js";
import type { Rule } from "./rule.js";

/** All of time, before a window narrows it. */
const UNBOUNDED: IntervalStream = [{ start: undefined, end: undefined }];

/** Which bound of a subtree a fold is reading. */
export type Pick = (of: Bounds) => IntervalStream;

export const certainOf: Pick = (of) => of.certain;
export const possibleOf: Pick = (of) => of.possible;

/**
 * A stream that can be read more than once.
 *
 * A generator is spent once it is walked, and both bounds walk their operands
 * separately. Re-running the evaluation is what the second bound costs, and it
 * is the whole of what a horizon costs anyone who declares one.
 */
export function repeatable(make: () => IntervalStream): IntervalStream {
  return {
    [Symbol.iterator]: (): Iterator<Interval> => make()[Symbol.iterator](),
  };
}

/**
 * A horizon laid over a subtree.
 *
 * What is certain stops at the horizon, and what is possible opens up past it,
 * because past it the subtree has stopped being evidence either way.
 */
export function beyond(
  inner: Bounds,
  at: Temporal.ZonedDateTime,
  context: Context,
): Bounds {
  const window = windowOf(context);
  return {
    certain: repeatable(() =>
      clip(inner.certain, { start: undefined, end: at }),
    ),
    possible: repeatable(() =>
      clip(union(inner.possible, [{ start: at, end: undefined }]), window),
    ),
  };
}

/**
 * A leaf read the one way, with a registry horizon laid over it if it has one.
 *
 * A `custom` rule is the case that matters. The document names a rule type
 * without knowing how far it was loaded, so the horizon comes from the code
 * answering rather than from the rule.
 */
export function settled(rule: Rule, context: Context): Bounds {
  const times = repeatable(() => intervals(rule, context));
  const whole: Bounds = { certain: times, possible: times };
  const at =
    rule.type === "custom" ? customHorizonAt(rule, context) : undefined;
  return at === undefined ? whole : beyond(whole, at, context);
}

/** Intersection, starting from all of time so that no rules means no limits. */
export function everyOf(
  parts: readonly Bounds[],
  context: Context,
  pick: Pick,
): IntervalStream {
  let covered = clip(UNBOUNDED, windowOf(context));
  for (const part of parts) {
    covered = intersect(covered, pick(part));
  }
  return covered;
}

/** Union, starting from nothing so that no rules means no times. */
export function anyOf(parts: readonly Bounds[], pick: Pick): IntervalStream {
  let covered: IntervalStream = [];
  for (const part of parts) {
    covered = union(covered, pick(part));
  }
  return covered;
}

/** The context's window, in the form the interval algebra takes. */
export function windowOf(context: Context): Interval {
  return { start: context.from, end: context.to };
}
