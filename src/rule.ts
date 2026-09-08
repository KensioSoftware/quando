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

import type { JsonValue } from "./json.js";

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
 * Months by name rather than by number, for the same reason weekdays are.
 *
 * A name cannot be off by one. Month numbers are 1-based in `Temporal` and
 * 0-based in `Date`, and a rule document is read by code that has met both.
 */
export const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

export type Month = (typeof MONTHS)[number];

/**
 * The two-digit part of a month code.
 *
 * Thirteen, because a Coptic year holds thirteen months and a Hebrew leap year
 * holds thirteen too.
 */
const MONTH_NUMBERS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
] as const;

/**
 * A month written the way `Temporal` writes one, which is the same way on
 * every calendar.
 *
 * `"M01"` to `"M13"`, and the same again with a trailing `"L"` for a leap
 * month. Which of them a calendar reaches is the calendar's business, and for
 * a leap month the year's as well, so this is every code that is well formed
 * rather than every code that can occur.
 */
export type MonthCode =
  | `M${(typeof MONTH_NUMBERS)[number]}`
  | `M${(typeof MONTH_NUMBERS)[number]}L`;

/** Every month code, in the order a calendar reaches them. */
export const MONTH_CODES: readonly MonthCode[] = MONTH_NUMBERS.flatMap(
  (number) => [`M${number}`, `M${number}L`] as const,
);

/**
 * The calendar periods a recurrence can step through.
 *
 * Plural, because they are always written after a count: `every(2, "weeks")`.
 * These are calendar periods rather than the exact elapsed units `accumulate`
 * takes, and a month is whatever length the calendar gives it.
 */
export const PERIODS = ["days", "weeks", "months", "years"] as const;

export type Period = (typeof PERIODS)[number];

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
  | DaysOfMonthRule
  | NthDayOfWeekInMonthRule
  | MonthsOfYearRule
  | MonthCodesRule
  | EveryRule
  | TimeOfDayRule
  | DatesRule
  | DateRangeRule
  | AtMostRule
  | AtMostTimeRule
  | SpacedByRule
  | CustomRule
  | InCalendarRule
  | InZoneRule
  | KnownRule
  | AllRule
  | AnyRule
  | NotRule;

/**
 * The rules that name something on a calendar or a clock and hold no others.
 *
 * The leaves. Several operations over the rule language split along this line,
 * because the leaves are where the vocabulary lives and the rest is structure.
 */
export type CalendarRule =
  | DaysOfWeekRule
  | DaysOfMonthRule
  | NthDayOfWeekInMonthRule
  | MonthsOfYearRule
  | MonthCodesRule
  | EveryRule
  | TimeOfDayRule
  | DatesRule
  | DateRangeRule;

/**
 * The rules that read what has already happened rather than the calendar.
 *
 * Everything else answers "is this instant permitted?" from the instant alone.
 * These answer it from a history, which the context carries as `occurrences`.
 * A cap and a spacing are both constraints on a pattern of occurrences, and
 * once the history is known each of them is an ordinary set of times, which is
 * what lets them compose with the rest. See
 * [occurrence-rules.ts](./occurrence-rules.ts).
 */
export type ConstraintRule = AtMostRule | AtMostTimeRule | SpacedByRule;

/**
 * At most `count` occurrences in each window.
 *
 * The window is written one of two ways and they mean different things.
 * `per` counts within calendar buckets, so `per: "days"` is four a day and the
 * count starts again at midnight. `within` is a rolling window written as an
 * ISO duration, so `within: "PT24H"` is four in any twenty-four hours and
 * nothing resets.
 */
export type AtMostRule = AtMostPerPeriod | AtMostWithin;

interface AtMostFields {
  readonly type: "atMost";
  readonly count: number;
  readonly zone?: string;
}

/** At most `count` in each calendar day, week, month or year. */
export interface AtMostPerPeriod extends AtMostFields {
  readonly per: Period;
  readonly within?: undefined;
}

/** At most `count` in any window of this length, as an ISO duration. */
export interface AtMostWithin extends AtMostFields {
  readonly within: string;
  readonly per?: undefined;
}

/**
 * At most `total` time occupied in each window.
 *
 * The sibling of {@link AtMostRule}, counting how long things went on rather
 * than how many there were. "90 days in any rolling 180" and "56 hours of
 * driving a week" are both this. An occurrence with no `lasting` takes no
 * time, so a history of moments never fills one.
 *
 * Both fields hold exact time. Years, months and weeks are refused, because
 * the sweep that answers this needs a window that is the same length wherever
 * it sits. A day is read as 24 hours.
 *
 * **What fills the cap is elapsed time, and `lasting` is calendar time.** An
 * occurrence of `P90D` from a London midnight running over a spring clock
 * change occupies 89 days and 23 hours, because that is how long it lasted.
 * Against a cap of `P90D` read as 90 times 24 hours it comes an hour short.
 * Write both in hours where the hour matters.
 */
export type AtMostTimeRule = AtMostTimePerPeriod | AtMostTimeWithin;

interface AtMostTimeFields {
  readonly type: "atMostTime";
  /** How much time may be occupied, as an ISO duration. */
  readonly total: string;
  readonly zone?: string;
}

/** At most `total` time in each calendar day, week, month or year. */
export interface AtMostTimePerPeriod extends AtMostTimeFields {
  readonly per: Period;
  readonly within?: undefined;
}

/** At most `total` time in any window of this length, as an ISO duration. */
export interface AtMostTimeWithin extends AtMostTimeFields {
  readonly within: string;
  readonly per?: undefined;
}

/**
 * Occurrences at least `gap` apart, as an ISO duration.
 *
 * Measured from the end of one to the start of the next. An occurrence that
 * lasted counts from when it finished. The rule reads both ways round. An
 * instant too close *before* an occurrence is refused the same as one too
 * close after, and that is what makes it mean one thing to a query looking
 * forward and to a check on a plan alike.
 */
export interface SpacedByRule {
  readonly type: "spacedBy";
  readonly gap: string;
}

/**
 * A rule an application supplies, named in the document and implemented in the
 * registry a query carries.
 *
 * Easter, sunset and an observed lunar month are all functions rather than
 * patterns, and none of them is a field on a leaf. The document holds the name
 * and whatever JSON the implementation needs, so it stores and travels like
 * every other rule. See [custom-rules.ts](./custom-rules.ts).
 */
export interface CustomRule {
  readonly type: "custom";

  /** What the registry on the context is looked up by. */
  readonly name: string;

  /** Configuration the named rule type reads. Any JSON value. */
  readonly options?: JsonValue;

  /** Reads the rule in this zone, the way `inZone` would. */
  readonly zone?: string;
}

/**
 * Evaluates a rule subtree on a named calendar.
 *
 * The instants do not move. What changes is the year, month and day a rule
 * reads off a date, so `daysOfMonth(1)` under `"hebrew"` covers Rosh Chodesh
 * and under the ISO calendar covers the first of each Gregorian month.
 *
 * Any calendar `Temporal` implements. Quando's month *names* are Gregorian, so
 * `monthsOfYear` and a cycle of months or years are refused on another
 * calendar rather than answered wrongly. `monthCodes` names a month on any of
 * them.
 */
export interface InCalendarRule {
  readonly type: "inCalendar";
  readonly calendar: string;
  readonly rule: Rule;
}

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
 * Whole days, by their position in the month.
 *
 * Counted from the start of the month at `1`, and from the end at `-1`, so the
 * last day of every month is `-1` whether the month has 28 days or 31. A day
 * the month does not reach simply does not match: `31` covers seven months of
 * the year and February in none of them.
 */
export interface DaysOfMonthRule {
  readonly type: "daysOfMonth";
  readonly days: readonly number[];
  /** Overrides the context's zone, for a rule about a particular place. */
  readonly zone?: string;
}

/**
 * Whole days, by which occurrence of their weekday they are in the month.
 *
 * The first Monday, the last Friday. Counted from the start of the month at
 * `1` and from the end at `-1`, so the last Friday is the last one whether the
 * month holds four or five. A month with only four of a weekday has no fifth,
 * and `5` covers no time in it.
 */
export interface NthDayOfWeekInMonthRule {
  readonly type: "nthDayOfWeekInMonth";
  readonly nth: number;
  readonly days: readonly Weekday[];
  readonly zone?: string;
}

/** Whole months, by Gregorian name. */
export interface MonthsOfYearRule {
  readonly type: "monthsOfYear";
  readonly months: readonly Month[];
  readonly zone?: string;
}

/**
 * Whole months, by the code `Temporal` gives them.
 *
 * `"M01"` through to `"M13"`, with a trailing `"L"` for a leap month. This is
 * the vocabulary every calendar shares, so one code names the month it names
 * wherever the rule is read: `"M01"` is January on the ISO calendar and Tishri
 * under `inCalendar("hebrew", ...)`.
 *
 * A leap month is its own month rather than a second helping of the one before
 * it. The Hebrew Adar I is `"M05L"` and Adar II is `"M06"`, and a rule wanting
 * both says both.
 *
 * A code the calendar in force never reaches covers no time, the way
 * `daysOfMonth(31)` covers no February. Which codes a calendar has depends on
 * the calendar and, for a leap month, on the year, and the rule is written long
 * before either is known.
 */
export interface MonthCodesRule {
  readonly type: "monthCodes";
  readonly codes: readonly MonthCode[];
  readonly zone?: string;
}

/**
 * Every nth period, counted from an anchor date.
 *
 * The whole of each selected period is covered, so `every(2, "weeks")` covers
 * seven days out of every fourteen. Intersect it with something narrower for
 * the day within them: with `daysOfWeek("monday")` it is every other Monday.
 *
 * The anchor sets the phase and nothing else. Periods are counted in both
 * directions from it, so a rule anchored in April also covers the right weeks
 * in March. Compose with `onOrAfter` to bound it, which keeps the two ideas
 * apart.
 */
export interface EveryRule {
  readonly type: "every";
  readonly interval: number;
  readonly period: Period;
  readonly anchor: string;
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

/**
 * Every day from one date to another, both ends included.
 *
 * A date names a whole day here, the way it does in `dates`, so a range from
 * `"2026-04-01"` to `"2026-04-30"` covers the whole of both.
 *
 * Either end may be left out for a bound open in that direction. Leaving out
 * both is all of time written the long way, and `always` already says that, so
 * the type is two shapes rather than one with two optional fields. A rule
 * holding neither bound will not compile, and `parseRule` refuses the same
 * document coming the other way.
 */
export type DateRangeRule = DateRangeFrom | DateRangeTo;

interface DateRangeBound {
  readonly type: "dateRange";
  readonly zone?: string;
}

/** Bounded below, and optionally above. */
interface DateRangeFrom extends DateRangeBound {
  readonly from: string;
  readonly to?: string;
}

/** Bounded above, and optionally below. */
interface DateRangeTo extends DateRangeBound {
  readonly to: string;
  readonly from?: string;
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

/**
 * A rule whose answer is only known up to a day.
 *
 * Wraps a subtree the way `inZone` and `inCalendar` do, and says something
 * about the answer rather than about the times. A holiday list loaded with
 * 2026 in it covers the days it names, and past the end of 2026 it stops
 * being evidence of anything.
 *
 * **A horizon is not a scope.** `onOrBefore` would make the subtree cover
 * nothing past the date, which is a confident answer of "no". This says there
 * is no answer, which is a different thing and the reason the type exists.
 */
export interface KnownRule {
  readonly type: "known";
  /** The last day the subtree's answer is known for, that day included. */
  readonly through: string;
  readonly rule: Rule;
  /** The zone the day ends in. The evaluation's own zone by default. */
  readonly zone?: string;
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
