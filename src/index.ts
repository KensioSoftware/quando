/**
 * Quando: declarative temporal rules for schedules, deadlines, constraints and
 * exceptions.
 *
 * What exists so far is the interval core, the rule language on top of it, and
 * the two ends of "rules are data": a builder that writes one, and a parser
 * that reads one back from whatever a database or a form actually held.
 * Cascades — layered rules carrying values — and the query surface are still to
 * come.
 *
 * Requires a runtime with `Temporal`: Node 26 or later, or a browser that
 * implements it.
 * Quando reads the global rather than importing a polyfill, so anywhere without
 * one natively can load `temporal-polyfill` first and everything here works
 * untouched.
 */

export type { Interval } from "./interval.js";
export {
  compareEnds,
  compareStarts,
  contains,
  duration,
  isEmpty,
  startsAtOrBeforeEnd,
  startsBeforeEnd,
} from "./interval.js";

export type { IntervalStream } from "./interval-stream.js";
export { clip, complement, intersect, union } from "./interval-stream.js";

export { take } from "./stream.js";

export type { Context } from "./context.js";

export type {
  AllRule,
  AnyRule,
  AlwaysRule,
  DatesRule,
  DaysOfWeekRule,
  NeverRule,
  NotRule,
  Rule,
  TimeOfDayRule,
  Weekday,
} from "./rule.js";
export { WEEKDAYS } from "./rule.js";

export { intervals } from "./interpret.js";

export type { Built } from "./build.js";
export {
  all,
  always,
  any,
  dates,
  daysOfWeek,
  inZone,
  never,
  not,
  timeOfDay,
  weekdays,
  weekends,
} from "./build.js";

export { parseRule } from "./parse.js";
