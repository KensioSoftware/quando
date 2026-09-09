/**
 * The several ways of reading one estimate.
 *
 * The whole point of keeping a distribution as the thing being computed is
 * that a range and a headline date and an SLA number are all views on it. Show
 * {@link support} to a customer, quote {@link quantile} at 0.95 in a contract,
 * and answer "will it arrive before Christmas?" with {@link chanceBefore}.
 *
 * There is deliberately no mean. The mean of a distribution over datetimes
 * lands on the instant axis, which puts it at three on a Saturday morning for
 * a courier that has never delivered at three on a Saturday morning. Median,
 * mode and quantiles all land on outcomes that can happen.
 */

import {
  type Distribution,
  type Estimate,
  isDistribution,
  type Outcome,
} from "./estimate.js";
import {
  orderedOutcomes,
  orderedValues,
  valuesOf,
} from "./estimate-coalesce.js";
import { naturally, type Order } from "./estimate-order.js";

/**
 * Every outcome an estimate allows, in order and each once.
 *
 * ```ts
 * support(spread([3, 1, 2, 1])); // [1, 2, 3]
 * ```
 *
 * The plain range shown to an end user is the first and last of these.
 */
export function support<V>(
  estimate: Estimate<V>,
  order: Order<V> = naturally,
): readonly V[] {
  return orderedValues(valuesOf(estimate), order);
}

/**
 * The likeliest outcome.
 *
 * Where two outcomes are equally likely, the earlier in order wins.
 */
export function mode<V>(over: Distribution<V>, order: Order<V> = naturally): V {
  const outcomes = settled(over, order, "mode()");

  let best = outcomes[0];
  for (const outcome of outcomes) {
    if (outcome.probability > best.probability) {
      best = outcome;
    }
  }
  return best.value;
}

/**
 * The outcome a given share of the probability falls at or below.
 *
 * ```ts
 * quantile(arrival, 0.95); // the date to promise, at 95% confidence
 * ```
 *
 * The answer is the first outcome whose running total reaches `at`, which is
 * always an outcome that can happen. `at` runs from 0 to 1 inclusive.
 */
export function quantile<V>(
  over: Distribution<V>,
  at: number,
  order: Order<V> = naturally,
): V {
  return shareAt(over, at, order, "quantile()");
}

/** The outcome half the probability falls at or below. */
export function median<V>(
  over: Distribution<V>,
  order: Order<V> = naturally,
): V {
  return shareAt(over, 0.5, order, "median()");
}

/**
 * How likely the answer comes in below a value.
 *
 * ```ts
 * chanceBefore(arrival, christmasEve); // 0.75
 * ```
 *
 * Strictly below, matching the half-open intervals the rest of the library
 * counts with. An outcome landing exactly on `value` falls outside.
 */
export function chanceBefore<V>(
  over: Distribution<V>,
  value: V,
  order: Order<V> = naturally,
): number {
  const outcomes = settled(over, order, "chanceBefore()");

  let running = 0;
  for (const outcome of outcomes) {
    if (order(outcome.value, value) >= 0) {
      return running;
    }
    running += outcome.probability;
  }
  return running;
}

/**
 * Ordered, coalesced outcomes, refusing anything that cannot be read.
 *
 * The result is at least one outcome, which is what lets every view above
 * answer with a value and no guard against a case that has already been ruled
 * out here.
 */
function settled<V>(
  over: Distribution<V>,
  order: Order<V>,
  called: string,
): readonly [Outcome<V>, ...Outcome<V>[]] {
  if (!isDistribution(over)) {
    throw new RangeError(
      `${called} needs weights, and a spread carries none. Say which ` +
        "distribution it stands for with assumeUniform(), or supply the " +
        "weights with chances().",
    );
  }

  const [first, ...rest] = orderedOutcomes(over.outcomes, order);
  if (first === undefined) {
    throw new RangeError(
      `${called} needs an outcome to answer with, and this distribution ` +
        "holds none. chances() refuses to build one.",
    );
  }
  return [first, ...rest];
}

/** The shared body of {@link quantile} and {@link median}. */
function shareAt<V>(
  over: Distribution<V>,
  at: number,
  order: Order<V>,
  called: string,
): V {
  if (!Number.isFinite(at) || at < 0 || at > 1) {
    throw new RangeError(`${called} takes a share from 0 to 1. Given ${at}.`);
  }
  const outcomes = settled(over, order, called);

  let running = 0;
  let last = outcomes[0];
  for (const outcome of outcomes) {
    running += outcome.probability;
    if (running >= at) {
      return outcome.value;
    }
    last = outcome;
  }

  // chances() allows a total a hair off one. A share of 1 can outrun the
  // running total, and the last outcome is the answer wherever it ends up.
  return last.value;
}
