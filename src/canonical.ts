/**
 * Comparing rules and cascades, and the one form that makes it possible.
 *
 * [canonical-rule.ts](./canonical-rule.ts) holds the normal form itself and
 * the reasoning behind where it stops. This is the surface over it: the same
 * treatment for a cascade, a stable key, and equality.
 */

import { canonicalRule } from "./canonical-rule.js";
import { type Cascade, isCascade, type Layer } from "./cascade.js";
import type { Rule } from "./rule.js";

function canonicalLayer<V>(layer: Layer<V>): Layer<V> {
  return "value" in layer
    ? { scope: canonicalRule(layer.scope), value: layer.value }
    : {
        scope: canonicalRule(layer.scope),
        replace: canonicalCascade(layer.replace),
      };
}

/**
 * Layers keep their order, because order is what a cascade means. What changes
 * is each scope, and a `merge` of `"override"` written out, which is the
 * default said twice.
 */
function canonicalCascade<V>(cascade: Cascade<V>): Cascade<V> {
  const layers = cascade.layers.map((layer) => canonicalLayer(layer));

  return cascade.merge === undefined || cascade.merge === "override"
    ? { type: "cascade", layers }
    : { type: "cascade", merge: cascade.merge, layers };
}

/**
 * The one form of a rule or a cascade that says what this one says.
 *
 * ```ts
 * canonical(weekdays().except(dates("2026-12-25")));
 * ```
 *
 * Flattens nested `all` and `any`, drops `always` from an `all` and `never`
 * from an `any`, settles the ones that dominate, cancels double negation,
 * deduplicates, and orders what is left. Leaves are ordered too, so
 * `daysOfWeek("friday", "monday")` and `daysOfWeek("monday", "friday")` are
 * the same document afterwards.
 *
 * A cascade keeps its layer order, because that order is its meaning.
 */
export function canonical(rule: Rule): Rule;
export function canonical<V>(cascade: Cascade<V>): Cascade<V>;
export function canonical<V>(value: Rule | Cascade<V>): Rule | Cascade<V> {
  return isCascade(value) ? canonicalCascade(value) : canonicalRule(value);
}

/**
 * A stable string for a rule or a cascade, the same for any two that say the
 * same thing.
 *
 * What a cache key is. A cascade's values go through `JSON.stringify` with
 * everything else, so this is worth as much as those values are storable.
 */
export function fingerprint<V>(value: Rule | Cascade<V>): string {
  return JSON.stringify(canonical(value as Rule));
}

/**
 * Whether two rules, or two cascades, say the same thing.
 *
 * Syntactic, and deliberately so. Two rules that cover the same time by
 * different routes are not equal, because deciding that in general means
 * evaluating them over all of time. `always` and all seven days of the week
 * are the pair to remember.
 */
export function equals<V>(
  left: Rule | Cascade<V>,
  right: Rule | Cascade<V>,
): boolean {
  return fingerprint(left) === fingerprint(right);
}
