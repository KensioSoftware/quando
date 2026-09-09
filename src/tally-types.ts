import type { Cascade } from "./cascade.js";
import type { RuleRegistry } from "./custom-rules.js";
import type { ElapsedUnit } from "./accumulate.js";
import type { DefaultExplanation } from "./explain.js";
import type { LayerOptions } from "./layer-options.js";
import type { RuleInput } from "./plain-forms.js";
import type {
  ValidationDiagnostic,
  ValidationOptions,
} from "./semantic-validation.js";
import type { ValuedStream } from "./valued-stream.js";
import type { EvaluationOptions } from "./context.js";

/** The local time zone used by tally contributions. */
export interface TallyOptions {
  readonly zone?: string;
}

/** The stored form of a tally. */
export interface TallyData {
  readonly type: "tally";
  readonly cascade: Cascade<number>;
  readonly zone?: string;
}

/** How a tally reaches its count at one instant. */
export type TallyExplanation = DefaultExplanation<number>;

/** Counts over time with methods for tally questions. */
export interface Tally extends TallyData {
  readonly plus: (
    scope: RuleInput,
    amount: number,
    options?: LayerOptions,
  ) => Tally;
  readonly setCount: (
    scope: RuleInput,
    amount: number,
    options?: LayerOptions,
  ) => Tally;
  /**
   * The same tally, reading `custom` rules from this registry.
   *
   * A registry holds functions, so it cannot live in the stored document. It
   * rides beside it, and `toJSON` is unchanged. Calling this twice replaces
   * the registry rather than merging the two.
   */
  readonly withCustomRules: (rules: RuleRegistry) => Tally;

  readonly countAt: (
    at: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => number;
  readonly explain: (
    at: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => TallyExplanation;
  readonly minimumCount: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => number;
  readonly totalBetween: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    unit: ElapsedUnit,
    options?: EvaluationOptions,
  ) => number;
  readonly countIntervals: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => ValuedStream<number>;
  readonly validate: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options?: EvaluationOptions & ValidationOptions,
  ) => readonly ValidationDiagnostic[];
  readonly toJSON: () => TallyData;
}
