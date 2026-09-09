import type { QueryArrival } from "./query-arrival.js";
export type { QueryArrival } from "./query-arrival.js";
import type { Slot, SlotOptions } from "./availability.js";
import type { Cascade } from "./cascade.js";
import type { EvaluationOptions } from "./context.js";
import type { RuleRegistry } from "./custom-rules.js";
import type { DurationInput } from "./duration-input.js";
import type { DefaultExplanation } from "./explain.js";
import type { Estimate } from "./estimate.js";
import type { Interval } from "./interval.js";
import type { LayerOptions } from "./layer-options.js";
import type { RuleInput } from "./plain-forms.js";
import type { Search } from "./query.js";
import type { OpenDayOptions } from "./schedule-days.js";
import type {
  ValidationDiagnostic,
  ValidationOptions,
} from "./semantic-validation.js";
import type { Timeline } from "./timeline.js";

/** The stored form of opening hours. */
export interface ScheduleData {
  readonly type: "schedule";
  readonly cascade: Cascade<boolean>;
  readonly zone?: string;
}

/** Opening times added to and removed from a schedule. */
export interface ScheduleChanges {
  readonly opened: Iterable<Interval>;
  readonly closed: Iterable<Interval>;
}

export type ScheduleExplanation = DefaultExplanation<boolean>;

/** Search limits and the settings needed to evaluate a schedule. */
export type ScheduleSearch = Search & EvaluationOptions;

/** Opening hours with immutable methods for definitions and queries. */
export interface Schedule extends ScheduleData {
  readonly open: {
    (scope: RuleInput, options?: LayerOptions): Schedule;
    (scope: RuleInput, hours: RuleInput, options?: LayerOptions): Schedule;
  };
  readonly closed: (scope: RuleInput, options?: LayerOptions) => Schedule;
  readonly setHours: (
    scope: RuleInput,
    hours: RuleInput,
    options?: LayerOptions,
  ) => Schedule;
  readonly withCustomRules: (rules: RuleRegistry) => Schedule;
  readonly isOpen: (
    at: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => boolean;
  readonly explain: (
    at: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => ScheduleExplanation;
  readonly nextOpenInterval: (
    from: Temporal.ZonedDateTime,
    options?: ScheduleSearch,
  ) => Interval | undefined;
  readonly firstOpenSlot: (
    from: Temporal.ZonedDateTime,
    lasting: DurationInput,
    options?: ScheduleSearch,
  ) => Slot | undefined;
  readonly openSlots: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options: SlotOptions & EvaluationOptions,
  ) => Iterable<Slot>;
  readonly changesTo: (
    next: Schedule,
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => ScheduleChanges;
  readonly validate: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options?: EvaluationOptions & ValidationOptions,
  ) => readonly ValidationDiagnostic[];
  readonly addOpenTime: <A extends DurationInput | Estimate<DurationInput>>(
    from: Temporal.ZonedDateTime,
    amount: A,
    options?: ScheduleSearch,
  ) => QueryArrival<A>;
  readonly openDuration: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => Temporal.Duration;
  readonly addOpenDays: <A extends number | Estimate<number>>(
    from: Temporal.ZonedDateTime,
    count: A,
    options?: OpenDayOptions,
  ) => QueryArrival<A>;
  readonly openDayCount: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => number;
  readonly timeline: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options?: EvaluationOptions,
  ) => Timeline;
  readonly toJSON: () => ScheduleData;
}

/** The local time zone used by schedule definitions. */
export interface ScheduleOptions {
  readonly zone?: string;
}
