import type { Cascade } from "./cascade.js";
import type { PlainRule } from "./plain-forms.js";
import type { ValidationDiagnostic } from "./semantic-validation.js";
import type { ValuedStream } from "./valued-stream.js";

/** The stored form of a tally. */
export interface TallyData {
  readonly type: "tally";
  readonly cascade: Cascade<number>;
}

/** Counts over time with methods for tally questions. */
export interface Tally extends TallyData {
  readonly plus: (scope: PlainRule, amount: number) => Tally;
  readonly exactly: (scope: PlainRule, amount: number) => Tally;
  readonly at: (at: Temporal.ZonedDateTime) => number;
  readonly least: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
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
