/**
 * Moving an estimate through a calculation, and putting two of them together.
 *
 * Mapping is where the whole design earns its place. A distribution over
 * working days becomes a distribution over datetimes by resolving each outcome
 * through the rules and accumulating its probability on the answer. That
 * mapping bends. One working day from a Friday lands on Monday and one from a
 * Monday lands on Tuesday, and two outcomes that land on the same instant have
 * to add up.
 *
 * Combining assumes the two estimates are independent. Real delays often are
 * not, and a shared cause makes the tail heavier than a convolution says. The
 * assumption is stated here because it cannot be checked here.
 */

import {
  type Distribution,
  type Estimate,
  isDistribution,
  type Outcome,
  type Spread,
} from "./estimate.js";
import {
  orderedOutcomes,
  orderedValues,
  valuesOf,
} from "./estimate-coalesce.js";
import { naturally, type Order } from "./estimate-order.js";

/**
 * An estimate with every outcome run through a calculation.
 *
 * ```ts
 * mapOutcomes(workingDays, (days) =>
 *   advanceByCoveredDays(ordered, days, { during: courier }),
 * );
 * ```
 *
 * Outcomes that land on the same answer are added together, which is the whole
 * of what makes a bending mapping come out right. A spread stays a spread and
 * a distribution stays a distribution, `assumed` and all.
 */
export function mapOutcomes<V, W>(
  estimate: Spread<V>,
  map: (value: V) => W,
  order?: Order<W>,
): Spread<W>;
export function mapOutcomes<V, W>(
  estimate: Distribution<V>,
  map: (value: V) => W,
  order?: Order<W>,
): Distribution<W>;
export function mapOutcomes<V, W>(
  estimate: Estimate<V>,
  map: (value: V) => W,
  order?: Order<W>,
): Estimate<W>;
export function mapOutcomes<V, W>(
  estimate: Estimate<V>,
  map: (value: V) => W,
  order: Order<W> = naturally,
): Estimate<W> {
  if (!isDistribution(estimate)) {
    const mapped = estimate.values.map(map);
    return { kind: "spread", values: orderedValues(mapped, order) };
  }

  const mapped = estimate.outcomes.map((outcome) => ({
    value: map(outcome.value),
    probability: outcome.probability,
  }));
  return weighted(orderedOutcomes(mapped, order), estimate.assumed);
}

/**
 * Two estimates put together, one outcome of each at a time.
 *
 * ```ts
 * combineOutcomes(packing, delivery, (hours, days) => ...);
 * ```
 *
 * **Independence is assumed.** Two parcels leaving the same warehouse on the
 * same morning share a cause, and combining them this way understates how
 * often both are late. Where a shared cause matters, model it as one estimate
 * over the cause and map that.
 *
 * Weights survive only where both sides have them. A spread on either side
 * gives a spread back, because there is no honest weight to give the pairs
 * it contributes.
 */
export function combineOutcomes<A, B, C>(
  left: Distribution<A>,
  right: Distribution<B>,
  join: (first: A, second: B) => C,
  order?: Order<C>,
): Distribution<C>;
export function combineOutcomes<A, B, C>(
  left: Estimate<A>,
  right: Estimate<B>,
  join: (first: A, second: B) => C,
  order?: Order<C>,
): Estimate<C>;
export function combineOutcomes<A, B, C>(
  left: Estimate<A>,
  right: Estimate<B>,
  join: (first: A, second: B) => C,
  order: Order<C> = naturally,
): Estimate<C> {
  if (isDistribution(left) && isDistribution(right)) {
    const paired: Outcome<C>[] = [];
    for (const one of left.outcomes) {
      for (const other of right.outcomes) {
        paired.push({
          value: join(one.value, other.value),
          probability: one.probability * other.probability,
        });
      }
    }
    const assumed = left.assumed === true || right.assumed === true;
    return weighted(orderedOutcomes(paired, order), assumed);
  }

  const paired: C[] = [];
  for (const one of valuesOf(left)) {
    for (const other of valuesOf(right)) {
      paired.push(join(one, other));
    }
  }
  return { kind: "spread", values: orderedValues(paired, order) };
}

/** A distribution from settled outcomes, carrying the assumption forward. */
function weighted<V>(
  outcomes: readonly Outcome<V>[],
  assumed: boolean | undefined,
): Distribution<V> {
  return assumed === true
    ? { kind: "distribution", outcomes, assumed: true }
    : { kind: "distribution", outcomes };
}
