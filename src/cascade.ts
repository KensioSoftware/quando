/**
 * Layers, and what holds inside them.
 *
 * A `Rule` says *when*. A `Cascade<V>` says *what holds when*: an ordered list
 * of layers, each pairing a scope with what applies inside it, resolved like
 * the rules in a stylesheet — the last layer to claim a moment wins.
 *
 * Keeping values here rather than on `Rule` is what lets the set algebra stay
 * simple. If a rule carried a value then every combinator would be generic in
 * it, and `not` would have to answer what the complement of a rota is. Values
 * only appear where they are actually needed, which is assignment.
 */

import type { Interval } from "./interval.js";
import type { Rule } from "./rule.js";

/**
 * An interval with a value assigned to it.
 *
 * Extends `Interval`, so everything that reads an interval — `duration`,
 * `contains`, `isEmpty` — reads one of these unchanged.
 */
export interface Valued<V> extends Interval {
  readonly value: V;
}

/**
 * One layer: where it applies, and what applies there.
 *
 * The two forms are separate fields rather than one field holding either,
 * because with one field the resolver would have to decide which meaning a
 * value carries by inspecting the shape of the caller's own domain type — and
 * for a `Cascade<Rule>` the two are indistinguishable.
 */
export type Layer<V> = ConstantLayer<V> | ReplacingLayer<V>;

/** A layer assigning one value across the whole of its scope. */
export interface ConstantLayer<V> {
  readonly scope: Rule;
  readonly value: V;
}

/**
 * A layer whose scope is claimed, but whose value inside it comes from another
 * cascade.
 *
 * This is the case a plain value cannot express. "On the eleventh we close at
 * three" is not `(scope: the eleventh, value: closed)`, which would shut the
 * whole day, and writing it as a value over 15:00–17:00 forces the author to
 * know the hours it is overriding — which is the thing a cascade exists to
 * avoid. What it means is: *within this scope, ignore the layers below and use
 * this instead.*
 */
export interface ReplacingLayer<V> {
  readonly scope: Rule;
  readonly replace: Cascade<V>;
}

/**
 * An ordered list of layers. Later layers win.
 *
 * Order is part of the meaning, so the JSON is an array and reordering it
 * changes the answer.
 */
export interface Cascade<V> {
  readonly type: "cascade";
  readonly layers: readonly Layer<V>[];
}

/** Whether a value is a cascade rather than a rule. */
export function isCascade<V>(value: Rule | Cascade<V>): value is Cascade<V> {
  return value.type === "cascade";
}

/** An ordered list of layers, lowest priority first. */
export function cascade<V>(...layers: readonly Layer<V>[]): Cascade<V> {
  return { type: "cascade", layers };
}

/** One value, across the whole of a scope. */
export function layer<V>(scope: Rule, value: V): ConstantLayer<V> {
  return { scope, value };
}

/**
 * True while a rule holds, and unassigned everywhere else.
 *
 * The bridge from *when* to *what*: it is how a plain schedule becomes a
 * cascade, and what {@link replace} lifts a bare rule with.
 */
export function whenever(rule: Rule): Cascade<boolean> {
  return cascade(layer(rule, true));
}

/**
 * A scope claimed outright, with what holds inside it given by another
 * cascade — or, for a schedule, by a rule.
 *
 * The rule form is sugar: it stores the lifted cascade, so the document is the
 * same either way and a stored layer never needs a reader to know which form
 * was written.
 */
export function replace<V>(
  scope: Rule,
  replacement: Cascade<V>,
): ReplacingLayer<V>;
export function replace(
  scope: Rule,
  replacement: Rule,
): ReplacingLayer<boolean>;
export function replace(
  scope: Rule,
  replacement: Rule | Cascade<unknown>,
): ReplacingLayer<unknown> {
  return {
    scope,
    replace: isCascade(replacement) ? replacement : whenever(replacement),
  };
}
