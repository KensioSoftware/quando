/**
 * Reading a cascade as the values it assigns, over time.
 *
 * Resolution is a fold. Each layer is read as the times it covers, and laid
 * over everything below it by the cascade's {@link MergeStrategy}. Precedence
 * falls out of that as the merge that keeps the later value, so a rota and a
 * roster of headcounts take the same path through here and differ only in what
 * they do where two layers meet.
 *
 * The regions themselves stay ordinary rules. A layer covers its own scope,
 * minus anything a *replacing* layer above it has claimed, and that is
 * `all(scope, not(any(…)))` which the rule interpreter already evaluates. So
 * the clipping, the zone normalisation and the laziness all come along
 * unchanged, and the one new sweep is the two-stream {@link overlay}.
 *
 * What comes back is only the time a cascade actually assigns. A moment no
 * layer claims is absent from the stream rather than present with some empty
 * value, for the same reason a rule yields only the time it covers. There is
 * no such thing as the value of an unassigned moment.
 */

import { asCascade, type CascadeLike, type Layer } from "./cascade.js";
import type { Context } from "./context.js";
import type { Interval } from "./interval.js";
import { intervals } from "./interpret.js";
import { mergeBy } from "./merge.js";
import type { Rule } from "./rule.js";
import { coalesce, overlay, type ValuedStream } from "./valued-stream.js";
import { checkWindow } from "./validation.js";

/**
 * The values a cascade assigns within a context, in order and coalesced.
 *
 * Lazy, and endless when the context has no end and the layers recur, which is
 * the same contract `intervals` keeps because this is built out of it.
 */
export function resolve<V>(
  source: CascadeLike<V>,
  context: Context,
): ValuedStream<V> {
  checkWindow(context.from, context.to);
  const cascade = asCascade(source);
  const merge = mergeBy<V>(cascade.merge);

  let stack: ValuedStream<V> = [];
  for (const [index, layer] of cascade.layers.entries()) {
    const above = cascade.layers.slice(index + 1);
    const claimed = assignments(layer, unreplaced(layer.scope, above), context);
    stack = overlay(stack, claimed, merge);
  }

  return coalesce(stack);
}

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
function unreplaced(scope: Rule, above: readonly Layer<unknown>[]): Rule {
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

/** What a layer assigns, over the region it covers. */
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
    // replaces. It also carries its own merge, so a replacement says how its
    // own layers combine without the cascade around it having a view.
    yield* resolve(layer.replace, within(context, interval));
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
