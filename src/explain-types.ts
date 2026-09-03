import type { MergeStrategy } from "./merge.js";
import type { Rule } from "./rule.js";

/** One matching constant layer and the value after it is applied. */
export interface AssignmentStep<V> {
  readonly type: "assignment";
  readonly path: string;
  readonly scope: Rule;
  readonly value: V;
  readonly result: V;
}

/** One matching replacement and the layers evaluated inside it. */
export interface ReplacementStep<V> {
  readonly type: "replacement";
  readonly path: string;
  readonly scope: Rule;
  readonly explanation: Explanation<V>;
}

/** One layer that takes part in a cascade result. */
export type ExplanationStep<V> = AssignmentStep<V> | ReplacementStep<V>;

/** The value at one instant and the matching layers that produce it. */
export interface Explanation<V> {
  readonly value: V | undefined;
  readonly merge: MergeStrategy;
  readonly steps: readonly ExplanationStep<V>[];
}

/** An explanation whose domain supplies a value for unassigned time. */
export interface DefaultExplanation<V> extends Explanation<V> {
  readonly value: V;
}
