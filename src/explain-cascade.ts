import { assignmentStep } from "./explain-assignment.js";
import type { Cascade } from "./cascade.js";
import type { Context } from "./context.js";
import type { Explanation, ExplanationStep } from "./explain-types.js";
import { firstEffectiveLayer, skippedLayers } from "./explain-skipped.js";
import {
  type ExplanationDomain,
  replacementDescription,
  summary,
} from "./explanation-text.js";
import { layerOptionsOf } from "./layer-options.js";
import { mergeBy } from "./merge.js";
import { explainRule } from "./rule-explanation.js";
import { resultDescription } from "./explanation-result-text.js";
import { unknownValueIn, refuse } from "./horizon-guard.js";

/** Builds the trace shared by core and domain explanations. */
export function explainCascade<V>(
  cascade: Cascade<V>,
  at: Temporal.ZonedDateTime,
  context: Omit<Context, "from" | "to"> | undefined,
  prefix: string,
  domain: ExplanationDomain,
): Explanation<V> {
  const window = { ...context, from: at, to: at.add({ nanoseconds: 1 }) };
  const fog = unknownValueIn(cascade, window);
  if (fog !== undefined) {
    refuse("explain()", fog, window, "unknownValueIntervals()");
  }
  const evaluated = cascade.layers.map((layer) => ({
    layer,
    match: explainRule(layer.scope, at, context),
  }));
  const first = firstEffectiveLayer(evaluated);
  const skipped = skippedLayers(evaluated, first, prefix);
  const merge = mergeBy<V>(cascade.merge);
  const steps: ExplanationStep<V>[] = [];
  let value: V | undefined;

  for (let index = first; index < cascade.layers.length; index += 1) {
    const layer = cascade.layers[index];
    const match = evaluated[index]?.match;
    if (layer === undefined || !(match?.status === "matched")) {
      continue;
    }

    const path = `${prefix}layers[${index}]`;
    if ("value" in layer) {
      const previous = value;
      value = value === undefined ? layer.value : merge(value, layer.value);
      steps.push(
        assignmentStep(
          layer,
          match,
          previous,
          value,
          path,
          cascade.merge ?? "override",
          domain,
        ),
      );
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
    summary: resultDescription(value, at, domain),
    details: summary(value, steps, skipped, at, domain),
    steps,
    skipped,
  };
}
