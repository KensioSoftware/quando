import type { Cascade, Layer } from "./cascade.js";
import { MERGE_STRATEGIES, type MergeStrategy } from "./merge.js";
import { fail, shapeOf } from "./parse-shape.js";

/** Reads and validates the optional merge field of a stored cascade. */
export function parseMerge(
  node: Record<string, unknown>,
  path: string,
): { merge?: MergeStrategy } {
  const merge = node["merge"];
  if (merge === undefined) {
    return {};
  }

  if (!MERGE_STRATEGIES.includes(merge as MergeStrategy)) {
    return fail(
      `${path}.merge`,
      typeof merge === "string"
        ? `"${merge}" is not a merge strategy. Expected one of ${MERGE_STRATEGIES.join(", ")}`
        : `expected a merge strategy, found ${shapeOf(merge)}`,
    );
  }
  return { merge: merge as MergeStrategy };
}

/** Checks that a parsed cascade's values match its declared merge strategy. */
export function checkMergeValues<V>(cascade: Cascade<V>, path: string): void {
  const check = (layer: Layer<V>, layerPath: string): void => {
    if ("replace" in layer) {
      layer.replace.layers.forEach((replacement, index) => {
        check(replacement, `${layerPath}.replace.layers[${index}]`);
      });
      return;
    }

    const valuePath = `${layerPath}.value`;
    const needsNumbers = ["sum", "max", "min"].includes(cascade.merge ?? "");
    if (needsNumbers && typeof layer.value !== "number") {
      throw new TypeError(`${valuePath}: ${cascade.merge} needs numbers.`);
    }
    if (cascade.merge === "concat" && !Array.isArray(layer.value)) {
      throw new TypeError(`${valuePath}: concat needs arrays.`);
    }
  };

  cascade.layers.forEach((layer, index) => {
    check(layer, `${path}.layers[${index}]`);
  });
}
