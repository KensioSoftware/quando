/**
 * Reading a cascade as the values it assigns, over time.
 *
 * The whole of resolution is one idea: **a layer holds where its own scope
 * holds and no layer above it claims the moment.** Said as a rule that is
 * `all(scope, not(any(…the scopes above)))`, which the rule interpreter
 * already knows how to evaluate — so precedence costs no new algebra, and the
 * clipping, the zone normalisation and the laziness all come along unchanged.
 *
 * What comes back is only the time a cascade actually assigns. A moment no
 * layer claims is absent from the stream rather than present with some empty
 * value, for the same reason a rule yields only the time it covers: there is
 * no such thing as the value of an unassigned moment.
 */

import type { Cascade, Layer } from "./cascade.js";
import type { Context } from "./context.js";
import type { Interval } from "./interval.js";
import { intervals } from "./interpret.js";
import type { Rule } from "./rule.js";
import { coalesce, interleave, type ValuedStream } from "./valued-stream.js";

/**
 * The values a cascade assigns within a context, in order and coalesced.
 *
 * Lazy, and endless when the context has no end and the layers recur — the
 * same contract `intervals` keeps, because this is built out of it.
 */
export function resolve<V>(
  cascade: Cascade<V>,
  context: Context,
): ValuedStream<V> {
  const claimed = cascade.layers.map((layer, index) =>
    assignments(
      layer,
      wins(layer.scope, cascade.layers.slice(index + 1)),
      context,
    ),
  );
  return coalesce(interleave(claimed));
}

/**
 * Where a layer wins: inside its own scope, and outside every scope above it.
 *
 * The layers above are re-evaluated once per layer below them, which is
 * quadratic in the number of layers. Layers are few and the streams are lazy,
 * so this buys a precedence that needs no sweep of its own for the price of
 * some repeated work over a handful of rules.
 */
function wins(scope: Rule, above: readonly Layer<unknown>[]): Rule {
  // For the top layer this is `all(scope, not(any()))` — `any()` covers no
  // time, its complement covers all of it, and the intersection is the scope
  // itself. Left general rather than special-cased: one path is easier to
  // trust than two, and the identities make the general one right.
  return {
    type: "all",
    rules: [
      scope,
      {
        type: "not",
        rule: { type: "any", rules: above.map((layer) => layer.scope) },
      },
    ],
  };
}

/** What a layer assigns, over the region it wins. */
function* assignments<V>(
  layer: Layer<V>,
  region: Rule,
  context: Context,
): ValuedStream<V> {
  for (const interval of intervals(region, context)) {
    if ("value" in layer) {
      yield { ...interval, value: layer.value };
      continue;
    }

    // A replacing layer claims the region and hands the question inwards. The
    // inner cascade is resolved against the region rather than against the
    // whole context, which is what stops it reaching outside the scope it
    // replaces — and what makes anything it leaves unassigned stay unassigned
    // rather than falling through to the layers this one outranks.
    yield* resolve(layer.replace, within(context, interval));
  }
}

/**
 * A context narrowed to one interval.
 *
 * The interval came from evaluating a rule against this context, so its start
 * is inside the window and never unbounded; the fallback is for the type
 * rather than for a case that occurs.
 */
function within(context: Context, interval: Interval): Context {
  const { from, to: _replaced, ...rest } = context;
  const start = interval.start ?? from;

  return interval.end === undefined
    ? { ...rest, from: start }
    : { ...rest, from: start, to: interval.end };
}
