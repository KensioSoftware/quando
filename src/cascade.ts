import {
  type Cascade,
  type ConstantLayer,
  type Layer,
  type ReplacingLayer,
  isCascade,
} from "./cascade-types.js";
import { checkCascadeValues } from "./cascade-validation.js";
import { assertJsonValue, type JsonCompatible } from "./json.js";
import type { MergeStrategy } from "./merge.js";
import type { Rule } from "./rule.js";

export type {
  Cascade,
  CascadeLike,
  ConstantLayer,
  HasCascade,
  Layer,
  ReplacingLayer,
  Valued,
} from "./cascade-types.js";
export { asCascade, isCascade } from "./cascade-types.js";

/** Creates an override cascade from layers in ascending priority. */
export function cascade<V>(...layers: readonly Layer<V>[]): Cascade<V> {
  const result: Cascade<V> = { type: "cascade", layers };
  checkCascadeValues(result, "cascade");
  return result;
}

export function merged(
  strategy: "sum" | "max" | "min",
  ...layers: readonly Layer<number>[]
): Cascade<number>;
export function merged<V>(
  strategy: "concat",
  ...layers: readonly Layer<readonly (V & JsonCompatible<V>)[]>[]
): Cascade<readonly V[]>;
export function merged<V>(
  strategy: "override",
  ...layers: readonly Layer<V & JsonCompatible<V>>[]
): Cascade<V>;
/** Creates a cascade whose overlapping layers use a named merge strategy. */
export function merged(
  strategy: MergeStrategy,
  ...layers: readonly Layer<unknown>[]
): Cascade<unknown> {
  const result: Cascade<unknown> = { type: "cascade", merge: strategy, layers };
  checkCascadeValues(result, "cascade");
  return result;
}

/** Assigns one JSON-compatible value throughout a rule's scope. */
export function layer<const V>(
  scope: Rule,
  value: V & JsonCompatible<V>,
): ConstantLayer<V> {
  assertJsonValue(value);
  return { scope, value };
}

/** Assigns true while a rule holds. */
export function whenever(rule: Rule): Cascade<boolean> {
  return cascade(layer(rule, true));
}

export function replace<V>(
  scope: Rule,
  replacement: Cascade<V & JsonCompatible<V>>,
): ReplacingLayer<V>;
export function replace(
  scope: Rule,
  replacement: Rule,
): ReplacingLayer<boolean>;
/** Replaces lower layers throughout a scope. */
export function replace(
  scope: Rule,
  replacement: Rule | Cascade<unknown>,
): ReplacingLayer<unknown> {
  const nested = isCascade(replacement) ? replacement : whenever(replacement);
  checkCascadeValues(nested, "replacement");
  return {
    scope,
    replace: nested,
  };
}
