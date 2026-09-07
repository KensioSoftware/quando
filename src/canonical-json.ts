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

/** The same value with every object's keys in ascending order. */
export function canonicalJson(value: JsonValue): JsonValue {
  if (isArray(value)) {
    return value.map((item) => canonicalJson(item));
  }
  if (!isObject(value)) {
    return value;
  }

  const ordered: Record<string, JsonValue> = {};
  const entries = Object.entries(value).toSorted(([left], [right]) =>
    left.localeCompare(right),
  );
  for (const [key, item] of entries) {
    ordered[key] = canonicalJson(item);
  }
  return ordered;
}
