/**
 * An answer with more than one possible outcome.
 *
 * A courier delivers in one to three working days. The plain range is what an
 * end user is shown, a planner wants the weights behind it, and both are views
 * on one object. [estimate-views.ts](./estimate-views.ts) has the views and
 * [estimate-outcomes.ts](./estimate-outcomes.ts) maps an estimate through the
 * rules.
 *
 * Two shapes live here because they answer different questions. A
 * {@link Spread} carries the outcomes and no weights. A {@link Distribution}
 * carries a probability against each outcome. Asking a spread for a median
 * throws, because the weights that would answer it were never supplied.
 * {@link assumeUniform} is how a caller says that assumption out loud.
 *
 * ```ts
 * const basic = spread([1, 2, 3]);
 * const advanced = chances([
 *   { value: 1, probability: 0.25 },
 *   { value: 2, probability: 0.5 },
 *   { value: 3, probability: 0.25 },
 * ]);
 * ```
 */

/** How likely one possible answer is. */
export interface Outcome<V> {
  /** The answer itself. */
  readonly value: V;

  /** Its probability, above zero and at most one. */
  readonly probability: number;
}

/** The outcomes an estimate allows, with nothing said about their weights. */
export interface Spread<V> {
  readonly kind: "spread";

  /**
   * Every outcome that can happen. A built spread keeps them as they were
   * given. One that came out of a mapping or a combination is in order, with
   * equal outcomes kept once.
   */
  readonly values: readonly V[];
}

/** The outcomes an estimate allows, each with a probability. */
export interface Distribution<V> {
  readonly kind: "distribution";

  /**
   * Every outcome that can happen. A built distribution keeps them as they
   * were given. One that came out of a mapping or a combination is in order,
   * with equal outcomes added together.
   */
  readonly outcomes: readonly Outcome<V>[];

  /**
   * True where the weights came from an assumption such as
   * {@link assumeUniform}. A quantile read off an assumed distribution is a
   * claim about the assumption, and this is how a caller tells the two apart.
   */
  readonly assumed?: boolean;
}

/** An answer with more than one possible outcome, weighted or otherwise. */
export type Estimate<V> = Distribution<V> | Spread<V>;

/** How far a total may drift from one before the weights are refused. */
const TOLERANCE = 1e-9;

/**
 * The outcomes something allows, with no claim about how likely each is.
 *
 * ```ts
 * spread([1, 2, 3]); // one to three working days, and nothing more said
 * ```
 *
 * This is the honest reading of "one to three working days". It composes by
 * carrying its outcomes forward, and every view that needs weights refuses it.
 * Duplicates are kept as given and coalesced by the views that order them.
 */
export function spread<V>(values: Iterable<V>): Spread<V> {
  const listed = [...values];
  if (listed.length === 0) {
    throw new RangeError(
      "spread() needs at least one outcome. An estimate with none describes " +
        "nothing that can happen.",
    );
  }
  return { kind: "spread", values: listed };
}

/**
 * The outcomes something allows, each with the probability it happens.
 *
 * ```ts
 * chances([
 *   { value: 1, probability: 0.25 },
 *   { value: 2, probability: 0.5 },
 *   { value: 3, probability: 0.25 },
 * ]);
 * ```
 *
 * The probabilities have to total one. A list that totals anything else is a
 * mistake somewhere upstream, and normalising it here would bury that.
 */
export function chances<V>(outcomes: Iterable<Outcome<V>>): Distribution<V> {
  const listed = [...outcomes];
  if (listed.length === 0) {
    throw new RangeError(
      "chances() needs at least one outcome. An estimate with none describes " +
        "nothing that can happen.",
    );
  }
  checkWeights(listed);
  return { kind: "distribution", outcomes: listed };
}

/**
 * One outcome at a probability of one.
 *
 * The deterministic case as an estimate, for combining a step that is known
 * with one that is estimated.
 */
export function certainly<V>(value: V): Distribution<V> {
  return { kind: "distribution", outcomes: [{ value, probability: 1 }] };
}

/**
 * A spread read as though every outcome were equally likely.
 *
 * ```ts
 * assumeUniform(spread([1, 2, 3])); // each at a third, and marked as assumed
 * ```
 *
 * The assumption is the caller's to make. Quando will not make it on their
 * behalf, because "one to three working days" says which days are possible and
 * says nothing about their weights. The result carries `assumed`, and
 * everything mapped or combined from it carries `assumed` too.
 */
export function assumeUniform<V>(over: Spread<V>): Distribution<V> {
  const share = 1 / over.values.length;
  return {
    kind: "distribution",
    outcomes: over.values.map((value) => ({ value, probability: share })),
    assumed: true,
  };
}

/** Whether an estimate carries weights. */
export function isDistribution<V>(
  estimate: Estimate<V>,
): estimate is Distribution<V> {
  return estimate.kind === "distribution";
}

/** Refuses weights that cannot be probabilities over these outcomes. */
function checkWeights<V>(outcomes: readonly Outcome<V>[]): void {
  let total = 0;
  for (const outcome of outcomes) {
    const { probability } = outcome;
    if (!Number.isFinite(probability) || probability <= 0) {
      throw new RangeError(
        `chances() takes probabilities above zero. Given ${probability}. ` +
          "An outcome that cannot happen is one to leave out.",
      );
    }
    total += probability;
  }
  if (Math.abs(total - 1) > TOLERANCE) {
    throw new RangeError(
      `chances() takes probabilities totalling 1. These total ${total}. ` +
        "Scaling them here would hide whichever one is wrong.",
    );
  }
}
