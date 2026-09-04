import type { SlotOptions } from "./availability.js";
import type { Cascade } from "./cascade.js";
import type { DefaultExplanation } from "./explain.js";
import type { Interval } from "./interval.js";
import type { LayerOptions } from "./layer-options.js";
import type { PlainRule } from "./plain-forms.js";
import type { Search } from "./query.js";
import type { ValidationDiagnostic } from "./semantic-validation.js";
import type {
  TimelineFormat,
  TimelineOptions,
  TimelineOutput,
} from "./timeline.js";

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

/** How a schedule reaches its open or closed value at one instant. */
export type ScheduleExplanation = DefaultExplanation<boolean>;

/** Opening hours with methods for common schedule questions. */
export interface Schedule extends ScheduleData {
  readonly open: {
    (scope: PlainRule, options?: LayerOptions): Schedule;
    (scope: PlainRule, hours: PlainRule, options?: LayerOptions): Schedule;
  };
  readonly closed: (scope: PlainRule, options?: LayerOptions) => Schedule;
  readonly hoursOn: (
    day: PlainRule,
    hours: PlainRule,
    options?: LayerOptions,
  ) => Schedule;
  readonly isOpen: (at: Temporal.ZonedDateTime) => boolean;
  readonly explain: (at: Temporal.ZonedDateTime) => ScheduleExplanation;
  readonly opensNext: (
    at: Temporal.ZonedDateTime,
    search?: Search | Temporal.Duration,
  ) => Interval | undefined;
  readonly firstOpenSlot: (
    from: Temporal.ZonedDateTime,
    lasting: Temporal.Duration,
    search?: Pick<Search, "within"> | Temporal.Duration,
  ) => Interval | undefined;
  readonly openSlots: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options: SlotOptions,
  ) => Iterable<Interval>;
  readonly changesTo: (
    next: Schedule,
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
  ) => ScheduleChanges;
  readonly validate: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
  ) => readonly ValidationDiagnostic[];
  readonly addOpenTime: (
    from: Temporal.ZonedDateTime,
    amount: Temporal.Duration,
    search?: Search,
  ) => Temporal.ZonedDateTime | undefined;
  readonly openDuration: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
  ) => Temporal.Duration;
  readonly renderTimeline: <F extends TimelineFormat = "json">(
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
    options?: TimelineOptions & { readonly format?: F },
  ) => TimelineOutput<F>;
  readonly toJSON: () => ScheduleData;
}

export interface ScheduleOptions {
  readonly zone?: string;
}
