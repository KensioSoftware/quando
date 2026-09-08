/**
 * Reading a rule as two bounds rather than one answer.
 *
 * Unknown is not a third value. It is the gap between what a rule certainly
 * covers and what it might. `certain` is the lower bound on the truth and
 * `possible` is the upper one, both ordinary interval streams, and everything
 * between them is time nobody has the data for.
 *
 * That shape is what makes a horizon cheap. Composition is the algebra Quando
 * already has, applied twice: `all` intersects both bounds, `any` unions both,
 * and `not` swaps them, which is Kleene logic falling out rather than being
 * implemented. And where no rule declares a horizon the two bounds are the
 * same stream, so nothing here costs anything to anyone who does not use it.
 *
 * The precision is the point. A weekday schedule minus a holiday list that
 * runs out at the end of 2026 is still confidently closed on a Saturday in
 * 2029. Only the weekdays are unknown, because only the weekdays are where the
 * missing holidays could have changed the answer.
 */

import { boundsOf } from "./bounds-algebra.js";
import { repeatable } from "./bounds-parts.js";
import { calendarOf } from "./context.js";
import type { Context } from "./context.js";
import { readIn } from "./interpret.js";
import { difference } from "./interval-difference.js";
import type { IntervalStream } from "./interval-stream.js";
import type { Rule } from "./rule.js";
import { checkWindow } from "./validation.js";

/** What a rule is worth knowing, as the two bounds that hold the answer. */
export interface Bounds {
  /** The times the rule certainly covers. */
  readonly certain: IntervalStream;
  /** The times it covers or might: everything not ruled out. */
  readonly possible: IntervalStream;
}

/**
 * Both bounds on what a rule covers, in order and coalesced.
 *
 * `certain` is what {@link intervals} would return for a rule that declares no
 * horizon, and narrower for one that does. Each bound is its own lazy stream
 * and may be read independently, or more than once.
 */
export function bounds(rule: Rule, context: Context): Bounds {
  checkWindow(context.from, context.to);
  const zone = context.from.timeZoneId;
  const calendar = calendarOf(context);
  return {
    certain: repeatable(() =>
      readIn(boundsOf(rule, context).certain, zone, calendar),
    ),
    possible: repeatable(() =>
      readIn(boundsOf(rule, context).possible, zone, calendar),
    ),
  };
}

/**
 * The times a rule neither covers nor rules out.
 *
 * Empty for every rule that declares no horizon, which is every rule written
 * before horizons existed.
 */
export function uncertain(rule: Rule, context: Context): IntervalStream {
  const both = bounds(rule, context);
  return repeatable(() => difference(both.possible, both.certain));
}
