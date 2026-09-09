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

import { asCascade, type CascadeLike } from "./cascade.js";
import type { Context } from "./context.js";
import type { IntervalStream } from "./interval-stream.js";
import { assignments, unreplaced } from "./resolve-layers.js";
import {
  type Uncertain,
  uncertainMerge,
  isKnown,
} from "./valued-uncertainty.js";
import { coalesce, overlay, type ValuedStream } from "./valued-stream.js";
import { checkWindow } from "./validation.js";

/**
 * The values a cascade assigns within a context, in order and coalesced.
 *
 * Lazy, and endless when the context has no end and the layers recur, which is
 * the same contract `intervals` keeps because this is built out of it.
 */
export function* resolve<V>(
  source: CascadeLike<V>,
  context: Context,
): ValuedStream<V> {
  for (const span of settled<V>(source, context)) {
    if (isKnown(span.value)) {
      yield { start: span.start, end: span.end, value: span.value };
    }
  }
}

/**
 * The stretches a cascade cannot settle a value for.
 *
 * Empty for every cascade whose layers declare no horizon. Where it is not,
 * each stretch is time the layers disagree about or have run out of data for,
 * and {@link resolve} leaves it out rather than picking one of the answers.
 */
export function* uncertainValues<V>(
  source: CascadeLike<V>,
  context: Context,
): IntervalStream {
  for (const span of settled<V>(source, context)) {
    if (!isKnown(span.value)) {
      yield { start: span.start, end: span.end };
    }
  }
}

/**
 * The fold, with an unknown carried through it as an ordinary value.
 *
 * See [valued-uncertainty.ts](./valued-uncertainty.ts) for why that is all
 * `override` needs to get the precise answer.
 */
function settled<V>(
  source: CascadeLike<V>,
  context: Context,
): ValuedStream<Uncertain<V>> {
  checkWindow(context.from, context.to);
  const cascade = asCascade(source);
  const merge = uncertainMerge<V>(cascade.merge);

  let stack: ValuedStream<Uncertain<V>> = [];
  for (const [index, layer] of cascade.layers.entries()) {
    const above = cascade.layers.slice(index + 1);
    const claimed = assignments(
      layer,
      unreplaced(layer.scope, above),
      context,
      settled,
    );
    stack = overlay(stack, claimed, merge);
  }

  return coalesce(stack);
}
