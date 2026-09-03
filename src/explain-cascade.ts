import type { Cascade, Layer } from "./cascade.js";
import type { Context } from "./context.js";
import type { Explanation, ExplanationStep } from "./explain-types.js";
import { skippedLayers } from "./explain-skipped.js";
import {
  assignmentDescription,
  type ExplanationDomain,
  replacementDescription,
  summary,
} from "./explanation-text.js";
import { layerOptionsOf } from "./layer-options.js";
import { mergeBy } from "./merge.js";
import { explainRule } from "./rule-explanation.js";

/** Builds the trace shared by core and domain explanations. */
export function explainCascade<V>(
  cascade: Cascade<V>,
  at: Temporal.ZonedDateTime,
  context: Omit<Context, "from" | "to"> | undefined,
  prefix: string,
  domain: ExplanationDomain,
): Explanation<V> {
  const evaluated = cascade.layers.map((layer) => ({
    layer,
    match: explainRule(layer.scope, at, context),
  }));
  const first = highestReplacement(
    cascade.layers,
    evaluated.map(({ match }) => match.matched),
  );
  const skipped = skippedLayers(evaluated, first, prefix);
  const merge = mergeBy<V>(cascade.merge);
  const steps: ExplanationStep<V>[] = [];
  let value: V | undefined;

  for (let index = first; index < cascade.layers.length; index += 1) {
    const layer = cascade.layers[index];
    const match = evaluated[index]?.match;
    if (layer === undefined || match?.matched !== true) {
      continue;
    }

    const path = `${prefix}layers[${index}]`;
    if ("value" in layer) {
      const previous = value;
      value = value === undefined ? layer.value : merge(value, layer.value);
      steps.push({
        type: "assignment",
        path,
        scope: layer.scope,
        match,
        description: assignmentDescription(
          layer,
          match,
          previous,
          value,
          cascade.merge ?? "override",
          domain,
        ),
        ...layerOptionsOf(layer),
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
      domain,
    );
    value = explanation.value;
    steps.push({
      type: "replacement",
      path,
      scope: layer.scope,
      match,
      description: replacementDescription(layer, match, domain),
      ...layerOptionsOf(layer),
      explanation,
    });
  }

  return {
    value,
    merge: cascade.merge ?? "override",
    summary: summary(value, steps, skipped, at, domain),
    steps,
    skipped,
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
