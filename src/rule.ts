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
  | CustomRule
  | InCalendarRule
  | InZoneRule
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
