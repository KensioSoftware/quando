import type { Cascade, Layer } from "./cascade.js";
import type { ValueParser } from "./parse-cascade.js";
import { asRecord, checkFields, fail } from "./parse-shape.js";
import { parseRule } from "./parse.js";
import { layerOptionsOf } from "./layer-options.js";

const LAYER_FIELDS = ["scope", "value", "replace", "label", "comment"];

/**
 * One layer: where it applies, and what applies there.
 *
 * Order of complaint follows order of reading. What the layer covers is
 * checked before what holds inside it, because a layer whose scope is broken
 * has nothing worth saying about its value.
 */
export function parseLayer<V>(
  value: unknown,
  parseValue: ValueParser<V>,
  path: string,
  parseCascade: (
    value: unknown,
    parseValue: ValueParser<V>,
    path: string,
  ) => Cascade<V>,
): Layer<V> {
  const node = asRecord(value, path, "a layer object");

  // `checkFields` waves `type` past, because every rule and every cascade
  // carries one. A layer does not, and a document that puts one here has
  // confused the layer with the cascade holding it.
  if ("type" in node) {
    fail(
      `${path}.type`,
      "is not a field of a layer. The cascade around it carries the type",
    );
  }
  checkFields(node, LAYER_FIELDS, path, "a layer");

  const scope = parseRule(node["scope"], `${path}.scope`);
  const holds = ["value", "replace"].filter((field) => field in node);
  const options = layerOptionsOf(node, path);

  if (holds.length === 2) {
    return fail(
      path,
      "has both a value and a replace, and a layer holds one or the other. " +
        "A value applies across the whole scope, and a replace hands the " +
        "scope to another cascade",
    );
  }

  if (holds[0] === "replace") {
    return {
      scope,
      replace: parseCascade(node["replace"], parseValue, `${path}.replace`),
      ...options,
    };
  }

  if (holds[0] === "value") {
    const parsed = parseValue(node["value"], `${path}.value`);
    return { scope, value: parsed, ...options };
  }

  return fail(
    path,
    "has neither a value nor a replace, so nothing holds inside its scope. " +
      "A layer built with `undefined` as its value arrives this way, because " +
      "`JSON.stringify` drops the field rather than writing it",
  );
}
