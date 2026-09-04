/**
 * Turning lists and names into English, for the explanation text.
 *
 * Nothing here knows about time. The describers in
 * [calendar-explanation-text.ts](./calendar-explanation-text.ts) and
 * [month-explanation-text.ts](./month-explanation-text.ts) do, and they share
 * these so that two accounts of a rule do not punctuate a list two ways.
 */

/** A name as it starts a sentence: `monday` becomes `Monday`. */
export function title(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

/** A list with the serial comma: `a`, `a and b`, `a, b, and c`. */
export function join(values: readonly string[]): string {
  if (values.length < 2) {
    return values[0] ?? "no days";
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}
