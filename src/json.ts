/** Values that JSON can represent without changing their meaning. */
export type JsonPrimitive = string | number | boolean | null;

/** A value that survives `JSON.stringify` followed by `JSON.parse`. */
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** The JSON-safe shape of an application type, including named interfaces. */
export type JsonCompatible<T> = T extends JsonPrimitive
  ? T
  : T extends (...arguments_: never[]) => unknown
    ? never
    : T extends readonly (infer V)[]
      ? readonly JsonCompatible<V>[]
      : T extends object
        ? { readonly [K in keyof T]: JsonCompatible<T[K]> }
        : never;

/** Refuses values that JSON would drop, reject, or silently change. */
export function assertJsonValue(
  value: unknown,
  path = "value",
): asserts value is JsonValue {
  const seen = new Set<object>();

  const visit = (current: unknown, currentPath: string): void => {
    if (
      current === null ||
      typeof current === "string" ||
      typeof current === "boolean"
    ) {
      return;
    }

    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        throw new TypeError(`${currentPath} must be a finite number.`);
      }
      return;
    }

    if (typeof current !== "object") {
      throw new TypeError(`${currentPath} is not JSON-compatible.`);
    }

    if (seen.has(current)) {
      throw new TypeError(`${currentPath} contains a circular reference.`);
    }
    seen.add(current);

    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        visit(item, `${currentPath}[${index}]`);
      });
    } else {
      const prototype = Object.getPrototypeOf(current) as object | null;
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(`${currentPath} must be a plain object.`);
      }
      for (const [key, item] of Object.entries(current)) {
        visit(item, `${currentPath}.${key}`);
      }
    }

    seen.delete(current);
  };

  visit(value, path);
}
