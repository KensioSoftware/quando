import { annotationDescription } from "./annotation-explanation-text.js";
import type { SkippedLayer } from "./explain-types.js";
import type { LayerOptions } from "./layer-options.js";
import type { RuleExplanation } from "./rule-explanation.js";

/** Writes why a layer did not contribute to the result. */
export function skippedDescription(
  options: LayerOptions,
  match: RuleExplanation,
  reason: SkippedLayer["reason"],
): string {
  const context = annotationDescription(options);
  const outcome =
    reason === "replaced"
      ? "A higher-priority replacement removes this matching layer."
      : "This layer does not apply.";
  return [context, match.description, outcome].filter(Boolean).join(" ");
}
