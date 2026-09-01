/**
 * Checking that incoming JSON is the shape it claims to be.
 *
 * Nothing here knows anything about time. These are the checks any document
 * needs on the way in, and they say what was found instead and where. The
 * `path` threaded through them is what turns "not a string" into
 * `rule.rules[1].rules[0].dates[0]: expected a string, found number`.
 *
 * [parse-fields.ts](./parse-fields.ts) sits on top with the checks that do
 * know about time, such as days of the week and zones.
 */

export function fail(path: string, problem: string): never {
  throw new TypeError(`${path}: ${problem}`);
}

/** What a value looks like, for an error message. */
export function shapeOf(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "an array";
  }
  return typeof value;
}

/**
 * `expected` names what should have been there, and reads straight into the
 * message. "a rule object", "a layer object".
 */
export function asRecord(
  value: unknown,
  path: string,
  expected: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(path, `expected ${expected}, found ${shapeOf(value)}`);
  }
  return value as Record<string, unknown>;
}

/**
 * Refuses a field the thing being parsed does not have.
 *
 * Quietly ignoring one is the worse option by some distance. A rule document
 * carrying `"zonee"` would parse as a perfectly valid rule with no zone, which
 * is a *different schedule* read in whatever zone the query happened to use,
 * and nothing would have said so.
 *
 * The cost is that a document written by a later version of Quando, carrying a
 * field this one has not heard of, is rejected rather than tolerated. That is
 * the right way round. A field exists to change what a document means, so
 * ignoring an unknown one is agreeing to get the answer wrong quietly.
 *
 * `type` is exempt, because every caller has already read it to get here.
 */
export function checkFields(
  node: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  what: string,
): void {
  for (const field of Object.keys(node)) {
    if (field !== "type" && !allowed.includes(field)) {
      fail(
        `${path}.${field}`,
        allowed.length === 0
          ? `is not a field of ${what}, which takes none`
          : `is not a field of ${what}. Expected ${allowed.join(", ")}`,
      );
    }
  }
}

export function asString(value: unknown, path: string): string {
  return typeof value === "string"
    ? value
    : fail(path, `expected a string, found ${shapeOf(value)}`);
}

export function asBoolean(value: unknown, path: string): boolean {
  return typeof value === "boolean"
    ? value
    : fail(path, `expected a boolean, found ${shapeOf(value)}`);
}

export function asStrings(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    return fail(path, `expected an array, found ${shapeOf(value)}`);
  }
  return value.map((item, index) =>
    typeof item === "string"
      ? item
      : fail(`${path}[${index}]`, `expected a string, found ${shapeOf(item)}`),
  );
}
