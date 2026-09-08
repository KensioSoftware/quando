/**
 * A JSON value written the one way, so that two documents saying the same
 * thing hash the same.
 *
 * Only object keys are reordered. Array order is part of what an array says,
 * and every other JSON value is already written one way. This exists for the
 * options a `custom` rule carries, the one place a rule document holds JSON
 * that Quando did not construct.
 *
 * Nothing here throws, for the reason given in
 * [canonical-rule.ts](./canonical-rule.ts).
 */

import { byCodeUnit } from "./code-unit-order.js";
import type { JsonValue } from "./json.js";

/** A JSON array. Narrowed here, because `Array.isArray` widens a readonly one. */
function isArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}

/** A JSON object, as opposed to an array or a primitive. */
function isObject(
  value: JsonValue,
): value is Readonly<Record<string, JsonValue>> {
  return typeof value === "object" && value !== null && !isArray(value);
}

/** Key order, by UTF-16 code unit. See [code-unit-order.ts](./code-unit-order.ts). */
function byKey(
  left: readonly [string, JsonValue],
  right: readonly [string, JsonValue],
): number {
  return byCodeUnit(left[0], right[0]);
}

/**
 * The same value with every object's keys in ascending order.
 *
 * Built with `Object.fromEntries`, which defines own properties. Assigning
 * them one at a time would hand a `"__proto__"` key to the inherited setter,
 * which drops it from the document and changes the prototype of the object
 * being built. JSON carries that key as ordinary data and so must this.
 */
export function canonicalJson(value: JsonValue): JsonValue {
  if (isArray(value)) {
    return value.map((item) => canonicalJson(item));
  }
  if (!isObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .toSorted(byKey)
      .map(([key, item]) => [key, canonicalJson(item)]),
  );
}
