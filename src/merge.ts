/**
 * What overlap means when two layers claim the same moment.
 *
 * Precedence answers it one way. The later layer wins and the earlier one is
 * displaced, which is what a rota and a schedule want: one person is on call,
 * and a shop is open or it is shut. Some domains want the other answer. Two
 * teams each putting three people on a Monday have six people on that Monday,
 * and a tariff built from a standing charge and a peak rate is the sum of
 * them.
 *
 * The strategy is a name in the document rather than a function passed to
 * `resolve`. A function cannot be stored, so a cascade carrying one would be a
 * document that no longer says what it means, and two readers of the same
 * stored cascade could disagree about the answer. The cost is a closed
 * vocabulary, which is the same trade the rule language already makes.
 */

/**
 * How overlapping layers combine.
 *
 * - `override` displaces. The later layer wins outright, and this is what a
 *   cascade does when it says nothing.
 * - `sum`, `max` and `min` are arithmetic over numbers.
 * - `concat` joins arrays, which is how a moment claimed by three layers comes
 *   back carrying all three.
 */
export type MergeStrategy = "override" | "sum" | "max" | "min" | "concat";

export const MERGE_STRATEGIES: readonly MergeStrategy[] = [
  "override",
  "sum",
  "max",
  "min",
  "concat",
];

/**
 * Combines the value already accumulated with the one a later layer assigns.
 *
 * `under` is everything below, already folded. `over` is the layer being
 * added. The order matters for `override` and for nothing else, which is why
 * it is stated rather than left to the reader.
 */
export type Merge<V> = (under: V, over: V) => V;

/** What a value looks like, for an error message. */
function nameOf(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return Array.isArray(value) ? "an array" : typeof value;
}

/**
 * The vocabulary is checked when a document is parsed. What the values in it
 * turn out to be is only known once a cascade is resolved, so a `sum` over
 * names fails here rather than at the boundary.
 *
 * The same split the rule language keeps. `parse.ts` checks shape and
 * vocabulary, and meaning is settled where the thing is evaluated.
 */
function wrongType(
  strategy: MergeStrategy,
  holds: string,
  found: unknown,
): never {
  throw new TypeError(
    `A cascade merging by "${strategy}" carries ${holds}, and this one holds ` +
      `${nameOf(found)}. Give it values it can combine, or merge by "override".`,
  );
}

function asNumber(strategy: MergeStrategy, value: unknown): number {
  return typeof value === "number"
    ? value
    : wrongType(strategy, "numbers", value);
}

function asArray(strategy: MergeStrategy, value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : wrongType(strategy, "arrays", value);
}

/**
 * The function a named strategy stands for.
 *
 * An absent strategy is `override`, so a cascade written before merging
 * existed means exactly what it did then.
 */
export function mergeBy<V>(strategy: MergeStrategy | undefined): Merge<V> {
  switch (strategy) {
    case "sum": {
      return (under, over) =>
        (asNumber("sum", under) + asNumber("sum", over)) as V;
    }

    case "max": {
      return (under, over) =>
        Math.max(asNumber("max", under), asNumber("max", over)) as V;
    }

    case "min": {
      return (under, over) =>
        Math.min(asNumber("min", under), asNumber("min", over)) as V;
    }

    case "concat": {
      return (under, over) =>
        [...asArray("concat", under), ...asArray("concat", over)] as V;
    }

    case "override":
    case undefined: {
      // The later layer displaces what is under it, which is the precedence a
      // cascade has always had and what one says by saying nothing.
      return (_under, over) => over;
    }
  }
}
