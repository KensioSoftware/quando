import type { ConstantLayer } from "./cascade.js";
import type { AssignmentStep } from "./explain-types.js";
import type { MergeStrategy } from "./merge.js";
import {
  assignmentDescription,
  type ExplanationDomain,
} from "./explanation-text.js";
import type { RuleExplanation } from "./rule-explanation.js";
import { layerOptionsOf } from "./layer-options.js";

/** Describes one assignment and its running result. */
export function assignmentStep<V>(
  layer: ConstantLayer<V>,
  match: RuleExplanation,
  previous: V | undefined,
  value: V,
  path: string,
  merge: MergeStrategy,
  domain: ExplanationDomain,
): AssignmentStep<V> {
  return {
    type: "assignment",
    path,
    scope: layer.scope,
    match,
    description: assignmentDescription(
      layer,
      match,
      previous,
      value,
      merge,
      domain,
    ),
    ...layerOptionsOf(layer),
    value: layer.value,
    result: value,
  };
}
