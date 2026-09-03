import type { MergeStrategy } from "./merge.js";
import type { Rule } from "./rule.js";
import type { RuleExplanation } from "./rule-explanation.js";

/** Information shared by every matching layer in an explanation. */
export interface ExplanationStepBase {
  readonly path: string;
  readonly scope: Rule;
  readonly match: RuleExplanation;
  readonly description: string;
  readonly label?: string;
  readonly comment?: string;
}

/** One matching constant layer and the value after it is applied. */
export interface AssignmentStep<V> extends ExplanationStepBase {
  readonly type: "assignment";
  readonly value: V;
  readonly result: V;
}

/** One matching replacement and the layers evaluated inside it. */
export interface ReplacementStep<V> extends ExplanationStepBase {
  readonly type: "replacement";
  readonly explanation: Explanation<V>;
}

/** One layer that takes part in a cascade result. */
export type ExplanationStep<V> = AssignmentStep<V> | ReplacementStep<V>;

/** One layer that did not take part in the result. */
export interface SkippedLayer extends ExplanationStepBase {
  readonly reason: "did-not-match" | "replaced";
}

/** The value at one instant and the matching layers that produce it. */
export interface Explanation<V> {
  readonly value: V | undefined;
  readonly merge: MergeStrategy;
  readonly summary: string;
  readonly steps: readonly ExplanationStep<V>[];
  readonly skipped: readonly SkippedLayer[];
}

/** An explanation whose domain supplies a value for unassigned time. */
export interface DefaultExplanation<V> extends Explanation<V> {
  readonly value: V;
}
