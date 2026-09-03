import type { Interval } from "./interval.js";
import type { JsonValue } from "./json.js";
import type { LayerOptions } from "./layer-options.js";
import type { MergeStrategy } from "./merge.js";
import type { Rule } from "./rule.js";

/** An interval with a JSON-compatible value assigned to it. */
export interface Valued<V> extends Interval {
  readonly value: V;
}

/** A layer assigning one value across its scope. */
export interface ConstantLayer<V> extends LayerOptions {
  readonly scope: Rule;
  readonly value: V;
}

/** A layer that replaces lower layers throughout its scope. */
export interface ReplacingLayer<V> extends LayerOptions {
  readonly scope: Rule;
  readonly replace: Cascade<V>;
}

/** A constant or replacing cascade layer. */
export type Layer<V> = ConstantLayer<V> | ReplacingLayer<V>;

/** An ordered list of value assignments. Later layers have higher priority. */
export interface Cascade<V = JsonValue> {
  readonly type: "cascade";
  readonly merge?: MergeStrategy;
  readonly layers: readonly Layer<V>[];
}

/** A domain façade backed by a cascade document. */
export interface HasCascade<V> {
  readonly cascade: Cascade<V>;
}

/** A cascade document or a domain façade backed by one. */
export type CascadeLike<V> = Cascade<V> | HasCascade<V>;

/** Returns the document behind a cascade or façade. */
export function asCascade<V>(value: CascadeLike<V>): Cascade<V> {
  return "cascade" in value ? value.cascade : value;
}

/** Checks whether a data node is a cascade. */
export function isCascade<V>(value: Rule | Cascade<V>): value is Cascade<V> {
  return value.type === "cascade";
}
