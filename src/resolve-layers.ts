/**
 * What one cascade layer contributes, and over which region.
 *
 * [resolve.ts](./resolve.ts) owns the fold. This owns the layer: which part of
 * its scope survives the replacements above it, what it assigns over the part
 * it certainly covers, and the unknown it leaves over the part it only might.
 */

import type { CascadeLike, Layer } from "./cascade.js";
import { bounds, unknownIntervals } from "./bounds.js";
import type { Context } from "./context.js";
import { hasHorizon } from "./horizon-shape.js";
import { intervals } from "./interpret.js";
import type { Interval } from "./interval.js";
import type { RuleData } from "./rule.js";
import { type Uncertain, UNKNOWN } from "./valued-uncertainty.js";
import { overlay, type ValuedStream } from "./valued-stream.js";

/** Resolves a nested cascade. Passed in, because `resolve.ts` recurses. */
type Settle = <V>(
  source: CascadeLike<V>,
  context: Context,
) => ValuedStream<Uncertain<V>>;

/**
 * A layer's own scope, minus every scope a replacing layer above it claims.
 *
 * Nothing needs subtracting for an ordinary layer above. The fold already
 * settles that, and under `override` the later value wins the overlap outright.
 * A replacing layer is the case that cannot be left to the fold, because it
 * claims its scope whether or not the cascade inside it assigns anything
 * there. Closing early on one day is exactly that. The base hours must stay
 * out of the afternoon the override dropped, rather than showing through it.
 */
export function unreplaced(
  scope: RuleData,
  above: readonly Layer<unknown>[],
): RuleData {
  const replacing = above.filter((layer) => "replace" in layer);
  if (replacing.length === 0) {
    return scope;
  }

  return {
    type: "all",
    rules: [
      scope,
      {
        type: "not",
        rule: { type: "any", rules: replacing.map((layer) => layer.scope) },
      },
    ],
  };
}

/**
 * What a layer assigns, over the region it covers.
 *
 * Two streams, laid over each other because each has to arrive in order. The
 * region the layer certainly covers carries its value, and the region it might
 * cover carries an unknown. The two are disjoint by construction, so the
 * overlay never actually merges anything and is only doing the interleaving.
 */
export function assignments<V>(
  layer: Layer<V>,
  region: RuleData,
  context: Context,
  settle: Settle,
): ValuedStream<Uncertain<V>> {
  return overlay<Uncertain<V>>(
    fog(region, context),
    claimed(layer, region, context, settle),
    (_under, over) => over,
  );
}

/** The region a layer might cover and might not, as spans of unknown. */
function* fog<V>(
  region: RuleData,
  context: Context,
): ValuedStream<Uncertain<V>> {
  for (const interval of unknownIntervals(region, context)) {
    yield { ...interval, value: UNKNOWN };
  }
}

/** The region a layer certainly covers, carrying what it assigns there. */
function* claimed<V>(
  layer: Layer<V>,
  region: RuleData,
  context: Context,
  settle: Settle,
): ValuedStream<Uncertain<V>> {
  const certain = hasHorizon(region, context.rules)
    ? bounds(region, context).certain
    : intervals(region, context);

  for (const interval of certain) {
    if ("value" in layer) {
      yield { ...interval, value: layer.value };
      continue;
    }

    // A replacing layer claims the region and hands the question inwards. The
    // inner cascade is resolved against the region rather than against the
    // whole context, which is what stops it reaching outside the scope it
    // replaces. It also carries its own merge, so a replacement says how its
    // own layers combine without the cascade around it having a view.
    yield* settle(layer.replace, within(context, interval));
  }
}

/**
 * A context narrowed to one interval.
 *
 * The interval came from evaluating a rule against this context, so its start
 * is inside the window and never unbounded. The fallback is for the type
 * rather than for a case that occurs.
 */
function within(context: Context, interval: Interval): Context {
  const { from, to: _replaced, ...rest } = context;
  const start = interval.start ?? from;

  return interval.end === undefined
    ? { ...rest, from: start }
    : { ...rest, from: start, to: interval.end };
}
