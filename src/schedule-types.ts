import type { Cascade } from "./cascade.js";
import type { Interval } from "./interval.js";
import type { PlainRule } from "./plain-forms.js";
import type { Search } from "./query.js";

/** The stored form of opening hours. */
export interface ScheduleData {
  readonly type: "schedule";
  readonly cascade: Cascade<boolean>;
  readonly zone?: string;
}

/** Opening hours with methods for common schedule questions. */
export interface Schedule extends ScheduleData {
  readonly open: (scope: PlainRule, hours?: PlainRule) => Schedule;
  readonly closed: (scope: PlainRule) => Schedule;
  readonly hoursOn: (day: PlainRule, hours: PlainRule) => Schedule;
  readonly isOpen: (at: Temporal.ZonedDateTime) => boolean;
  readonly opensNext: (
    at: Temporal.ZonedDateTime,
    search?: Search | Temporal.Duration,
  ) => Interval | undefined;
  readonly addOpenTime: (
    from: Temporal.ZonedDateTime,
    amount: Temporal.Duration,
    search?: Search,
  ) => Temporal.ZonedDateTime | undefined;
  readonly openDuration: (
    from: Temporal.ZonedDateTime,
    to: Temporal.ZonedDateTime,
  ) => Temporal.Duration;
  readonly toJSON: () => ScheduleData;
}

export interface ScheduleOptions {
  readonly zone?: string;
}
