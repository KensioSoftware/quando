import type { Cascade } from "./cascade.js";
import type { ElapsedUnit } from "./accumulate.js";
import type { DefaultExplanation } from "./explain.js";
import type { LayerOptions } from "./layer-options.js";
import type { PlainRule } from "./plain-forms.js";
import type { ValidationDiagnostic } from "./semantic-validation.js";
import type { ValuedStream } from "./valued-stream.js";

/** The stored form of a tally. */
export interface TallyData {
  readonly type: "tally";
  readonly cascade: Cascade<number>;
}

/** How a tally reaches its count at one instant. */
export type TallyExplanation = DefaultExplanation<number>;

/** Counts over time with methods for tally questions. */
export interface Tally extends TallyData {
  readonly plus: (
    scope: PlainRule,
    amount: number,
    options?: LayerOptions,
  ) => Tally;
  readonly exactly: (
    scope: PlainRule,
    amount: number,
    options?: LayerOptions,
  ) => Tally;
  readonly at: (at: Temporal.ZonedDateTime) => number;
  readonly explain: (at: Temporal.ZonedDateTime) => TallyExplanation;
  readonly least: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
  ) => number;
  readonly totalBetween: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    unit: ElapsedUnit,
  ) => number;
  readonly counts: (
    from: Temporal.ZonedDateTime,
    to?: Temporal.ZonedDateTime,
  ) => ValuedStream<number>;
  readonly validate: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
  ) => readonly ValidationDiagnostic[];
  readonly toJSON: () => TallyData;
}
