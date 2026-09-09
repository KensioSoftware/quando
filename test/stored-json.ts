/** Exercises the JSON boundary used to persist definitions. */
export function storedJSON(value: unknown): unknown {
  const text = JSON.stringify(value);
  return JSON.parse(text) as unknown;
}
