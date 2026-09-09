import type { Layer } from "./cascade.js";
import type { SkippedLayer } from "./explain-types.js";
import { layerOptionsOf } from "./layer-options.js";
import type { RuleExplanation } from "./rule-explanation.js";
import { skippedDescription } from "./skipped-explanation-text.js";

/** Starts at the last matching replacement, which discards earlier layers. */
export function firstEffectiveLayer<V>(
  evaluated: readonly {
    readonly layer: Layer<V>;
    readonly match: RuleExplanation;
  }[],
): number {
  return Math.max(
    0,
    evaluated.findLastIndex(
      ({ layer, match }) => "replace" in layer && match.status === "matched",
    ),
  );
}

/** Accounts for layers rejected by their rule or a replacement. */
export function skippedLayers<V>(
  evaluated: readonly {
    readonly layer: Layer<V>;
    readonly match: RuleExplanation;
  }[],
  first: number,
  prefix: string,
): readonly SkippedLayer[] {
  return evaluated.flatMap(({ layer, match }, index) => {
    const reason =
      match.status === "matched"
        ? index < first
          ? "replaced"
          : undefined
        : "did-not-match";
    if (reason === undefined) {
      return [];
    }
    return {
      path: `${prefix}layers[${index}]`,
      scope: layer.scope,
      match,
      reason,
      description: skippedDescription(layer, match, reason),
      ...layerOptionsOf(layer),
    };
  });
}
