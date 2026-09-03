/**
 * The rule language, as data.
 *
 * A rule is a plain JSON value with a `type` tag — not an object with methods.
 * That is what makes storing one, sending one over a wire, and validating one
 * cost nothing: the document *is* the rule. It also means a new operation over
 * rules is a new function rather than a new method on every rule type, which
 * matters because there are many operations coming — evaluating, describing,
 * validating, rendering, diffing — and comparatively few rule types.
 */

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/**
 * A rule says *when*, and nothing else. It is boolean: the times it covers and
 * the times it does not.
 *
 * Values — who is on call, what the tariff is — attach to layers rather than to
 * rules, which is what keeps `not` meaningful and the set algebra simple.
 */
export type Rule =
  | AlwaysRule
  | NeverRule
  | DaysOfWeekRule
  | TimeOfDayRule
  | DatesRule
  | InZoneRule
  | AllRule
  | AnyRule
  | NotRule;

/** All time. The identity for intersection. */
export interface AlwaysRule {
  readonly type: "always";
}

/** No time at all. The identity for union. */
export interface NeverRule {
  readonly type: "never";
}

/** Whole days, by their day of the week. */
export interface DaysOfWeekRule {
  readonly type: "daysOfWeek";
  readonly days: readonly Weekday[];
  /** Overrides the context's zone, for a rule about a particular place. */
  readonly zone?: string;
}

/**
 * A window within each day, as wall-clock times: `"09:00"` to `"17:00"`.
 *
 * Wall clock is what people write and what schedules mean. Across a daylight
 * saving transition the elapsed length of the window changes and the clock
 * times do not, which is the right way round.
 *
 * A `to` earlier than `from` wraps past midnight, so `"22:00"` to `"06:00"` is
 * a night shift rather than nothing.
 */
export interface TimeOfDayRule {
  readonly type: "timeOfDay";
  readonly from: string;
  readonly to: string;
  readonly zone?: string;
}

/** Whole days, by date: `"2026-03-14"`. */
export interface DatesRule {
  readonly type: "dates";
  readonly dates: readonly string[];
  readonly zone?: string;
}

/** A rule evaluated using one time zone throughout its subtree. */
export interface InZoneRule {
  readonly type: "inZone";
  readonly zone: string;
  readonly rule: Rule;
}

/** Every rule must hold: intersection. */
export interface AllRule {
  readonly type: "all";
  readonly rules: readonly Rule[];
}

/** At least one rule must hold: union. */
export interface AnyRule {
  readonly type: "any";
  readonly rules: readonly Rule[];
}

/** The times a rule does not hold: complement. */
export interface NotRule {
  readonly type: "not";
  readonly rule: Rule;
}
