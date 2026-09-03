import type { Cascade, Layer } from "./cascade.js";
import { assertJsonValue } from "./json.js";
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

/** Checks every constant value in a cascade, including replacements. */
export function checkCascadeValues<V>(cascade: Cascade<V>, path: string): void {
  cascade.layers.forEach((layer, index) => {
    const layerPath = `${path}.layers[${index}]`;
    if ("replace" in layer) {
      checkCascadeValues(layer.replace, `${layerPath}.replace`);
    } else {
      assertJsonValue(layer.value, `${layerPath}.value`);
    }
  });
}

/** Checks that each cascade's values match its own merge strategy. */
export function checkMergeValues<V>(cascade: Cascade<V>, path: string): void {
  const check = (current: Cascade<V>, currentPath: string): void => {
    current.layers.forEach((layer: Layer<V>, index) => {
      const layerPath = `${currentPath}.layers[${index}]`;
      if ("replace" in layer) {
        check(layer.replace, `${layerPath}.replace`);
        return;
      }

      const valuePath = `${layerPath}.value`;
      const needsNumbers = ["sum", "max", "min"].includes(current.merge ?? "");
      if (needsNumbers && typeof layer.value !== "number") {
        throw new TypeError(`${valuePath}: ${current.merge} needs numbers.`);
      }
      if (current.merge === "concat" && !Array.isArray(layer.value)) {
        throw new TypeError(`${valuePath}: concat needs arrays.`);
      }
    });
  };

  check(cascade, path);
}
