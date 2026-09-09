/**
 * Putting outcomes in order, and adding together the ones that met.
 *
 * Two outcomes an order cannot separate are one answer. A count of working
 * days that lands on the same Monday from either side of a weekend is the
 * example the rest of this feature exists for, and the mass of both belongs on
 * that Monday. Every view and every mapping goes through here first.
 */

import type { Estimate, Outcome } from "./estimate.js";
import { isDistribution } from "./estimate.js";
import type { Order } from "./estimate-order.js";

/** Every outcome an estimate allows, weights aside. */
export function valuesOf<V>(estimate: Estimate<V>): readonly V[] {
  return isDistribution(estimate)
    ? estimate.outcomes.map((outcome) => outcome.value)
    : estimate.values;
}

/** Outcomes in order, with equal ones added together. */
export function orderedOutcomes<V>(
  outcomes: readonly Outcome<V>[],
  order: Order<V>,
): readonly Outcome<V>[] {
  const sorted = outcomes.toSorted((left, right) =>
    order(left.value, right.value),
  );

  const settled: Outcome<V>[] = [];
  for (const outcome of sorted) {
    // Two outcomes the order cannot separate are one answer, and their mass
    // belongs together. The first of them is the one kept.
    const last = settled.at(-1);
    if (last !== undefined && order(last.value, outcome.value) === 0) {
      settled[settled.length - 1] = {
        value: last.value,
        probability: last.probability + outcome.probability,
      };
    } else {
      settled.push(outcome);
    }
  }
  return settled;
}

/** Values in order, with equal ones kept once. */
export function orderedValues<V>(
  values: readonly V[],
  order: Order<V>,
): readonly V[] {
  const sorted = values.toSorted(order);

  const settled: V[] = [];
  for (const value of sorted) {
    if (settled.length === 0) {
      settled.push(value);
      continue;
    }

    // `undefined` is a value a mapping can produce, and `toSorted` puts every
    // one of them at the end without consulting the order. Reading the last
    // entry back cannot tell that apart from an empty run, so the length above
    // is what says the run has started. Two undefined outcomes are one answer.
    const last = settled.at(-1);
    if (last !== undefined && order(last, value) !== 0) {
      settled.push(value);
    }
  }
  return settled;
}
