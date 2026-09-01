/**
 * Turning arbitrary JSON back into a cascade.
 *
 * The boundary `parseRule` keeps, one level up. A cascade is stored, sent and
 * edited the way a rule is, so what comes back is whatever a database row, an
 * API body or a form actually held, and the useful thing to do with a bad one
 * is say precisely what is wrong and where.
 *
 * One thing differs, and it is why this takes an argument `parseRule` does
 * not. The rule vocabulary is closed, so `parseRule` knows every rule there
 * is. The values in a cascade are the caller's own domain type: a name, a
 * tariff, a headcount. Quando has never seen one and has nothing to check it
 * against, so the caller supplies the function that reads one.
 */

import type { Cascade, Layer } from "./cascade.js";
import { MERGE_STRATEGIES, type MergeStrategy } from "./merge.js";
import { asRecord, checkFields, fail, shapeOf } from "./parse-shape.js";
import { parseRule } from "./parse.js";

/**
 * Reads one stored value back at the type the caller keeps it in, or throws
 * saying what is wrong.
 *
 * The `path` says where in the document the value sits, and belongs at the
 * front of whatever the function throws. {@link fail} writes one in the same
 * form the rest of parsing uses.
 */
export type ValueParser<V> = (value: unknown, path: string) => V;

const CASCADE_FIELDS = ["merge", "layers"];
const LAYER_FIELDS = ["scope", "value", "replace"];

/**
 * A cascade from unknown JSON, or a `TypeError` saying what is wrong and where.
 *
 * ```ts
 * const onCall = parseCascade(JSON.parse(stored), asString);
 * ```
 *
 * The `path` is what appears in front of every message, so a value six layers
 * down reports as `cascade.layers[2].replace.layers[0].value` rather than as a
 * puzzle.
 */
export function parseCascade<V>(
  value: unknown,
  parseValue: ValueParser<V>,
  path = "cascade",
): Cascade<V> {
  const node = asRecord(value, path, "a cascade object");
  const type = node["type"];

  if (type !== "cascade") {
    return fail(
      `${path}.type`,
      typeof type === "string"
        ? `expected "cascade", found "${type}"`
        : `expected "cascade", found ${shapeOf(type)}`,
    );
  }
  checkFields(node, CASCADE_FIELDS, path, "a cascade");

  const layers = node["layers"];
  if (!Array.isArray(layers)) {
    return fail(
      `${path}.layers`,
      `expected an array of layers, found ${shapeOf(layers)}`,
    );
  }

  return {
    type: "cascade",
    ...mergePart(node, path),
    layers: layers.map((layer, index) =>
      parseLayer(layer, parseValue, `${path}.layers[${index}]`),
    ),
  };
}

/**
 * Present or absent, never present-and-undefined, so a cascade that says
 * nothing about merging serialises back to the document it came from.
 *
 * The name is checked here. Whether the values it will be handed are ones it
 * can combine is not, because that is only known once the cascade is resolved.
 */
function mergePart(
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

/**
 * One layer: where it applies, and what applies there.
 *
 * Order of complaint follows order of reading. What the layer covers is
 * checked before what holds inside it, because a layer whose scope is broken
 * has nothing worth saying about its value.
 */
function parseLayer<V>(
  value: unknown,
  parseValue: ValueParser<V>,
  path: string,
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
  const holds = LAYER_FIELDS.filter(
    (field) => field !== "scope" && field in node,
  );

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
    };
  }

  if (holds[0] === "value") {
    return { scope, value: parseValue(node["value"], `${path}.value`) };
  }

  return fail(
    path,
    "has neither a value nor a replace, so nothing holds inside its scope. " +
      "A layer built with `undefined` as its value arrives this way, because " +
      "`JSON.stringify` drops the field rather than writing it",
  );
}
