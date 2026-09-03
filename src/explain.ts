/** Explains how a cascade reaches its value at one instant. */

import { activeAt } from "./query.js";
import {
  asCascade,
  type Cascade,
  type CascadeLike,
  type Layer,
} from "./cascade.js";
import type { Context } from "./context.js";
import type {
  DefaultExplanation,
  Explanation,
  ExplanationStep,
} from "./explain-types.js";
import { mergeBy } from "./merge.js";

export type {
  AssignmentStep,
  DefaultExplanation,
  Explanation,
  ExplanationStep,
  ReplacementStep,
} from "./explain-types.js";

/** Explains the value a cascade assigns at one instant. */
export function explain<V>(
  source: CascadeLike<V>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): Explanation<V> {
  return explainCascade(asCascade(source), at, context, "");
}

/** Applies the value a domain gives to unassigned time. */
export function withDefaultValue<V>(
  explanation: Explanation<V>,
  fallback: V,
): DefaultExplanation<V> {
  return { ...explanation, value: explanation.value ?? fallback };
}

function explainCascade<V>(
  cascade: Cascade<V>,
  at: Temporal.ZonedDateTime,
  context: Omit<Context, "from" | "to"> | undefined,
  prefix: string,
): Explanation<V> {
  const active = cascade.layers.map((layer) =>
    activeAt(layer.scope, at, context),
  );
  const first = highestReplacement(cascade.layers, active);
  const merge = mergeBy<V>(cascade.merge);
  const steps: ExplanationStep<V>[] = [];
  let value: V | undefined;

  for (let index = first; index < cascade.layers.length; index += 1) {
    const layer = cascade.layers[index];
    if (layer === undefined || active[index] !== true) {
      continue;
    }

    const path = `${prefix}layers[${index}]`;
    if ("value" in layer) {
      value = value === undefined ? layer.value : merge(value, layer.value);
      steps.push({
        type: "assignment",
        path,
        scope: layer.scope,
        value: layer.value,
        result: value,
      });
      continue;
    }

    const explanation = explainCascade(
      layer.replace,
      at,
      context,
      `${path}.replace.`,
    );
    value = explanation.value;
    steps.push({
      type: "replacement",
      path,
      scope: layer.scope,
      explanation,
    });
  }

  return {
    value,
    merge: cascade.merge ?? "override",
    steps,
  };
}

function highestReplacement<V>(
  layers: readonly Layer<V>[],
  active: readonly boolean[],
): number {
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    if (layer !== undefined && "replace" in layer && active[index] === true) {
      return index;
    }
  }
  return 0;
}
