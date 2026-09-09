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

import type { Cascade } from "./cascade.js";
import {
  checkCascadeValues,
  checkMergeValues,
  parseMerge,
} from "./cascade-validation.js";
import { asRecord, checkFields, fail, shapeOf } from "./parse-shape.js";
import { parseLayer } from "./parse-layer.js";
import { parsed } from "./parse-error.js";

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

/**
 * A cascade from unknown JSON, or a `TypeError` saying what is wrong and where.
 *
 * ```ts
 * const onCall = parseCascade(JSON.parse(stored), parseString);
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
  return parsed(path, () => parseCascadeData(value, parseValue, path));
}

function parseCascadeData<V>(
  value: unknown,
  parseValue: ValueParser<V>,
  path: string,
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

  const cascade: Cascade<V> = {
    type: "cascade",
    ...parseMerge(node, path),
    layers: layers.map((layer, index) =>
      parseLayer(layer, parseValue, `${path}.layers[${index}]`, parseCascade),
    ),
  };
  checkCascadeValues(cascade, path);
  checkMergeValues(cascade, path);
  return cascade;
}
