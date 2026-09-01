/**
 * Quando: declarative temporal rules for schedules, deadlines, constraints and
 * exceptions.
 *
 * What exists so far is the interval core, the rule language on top of it, and
 * the two ends of "rules are data": a builder that writes one, and a parser
 * that reads one back from whatever a database or a form actually held.
 * Queries sit on top: is it open now, how much working time is in this window,
 * when does it next open, and where do you get to after three hours that only
 * count while it is open. Cascades sit beside them: ordered layers that carry
 * values, resolved by precedence, for the questions a boolean schedule cannot
 * answer.
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

export type { ValueParser } from "./parse-cascade.js";
export { parseCascade } from "./parse-cascade.js";

export { asBoolean, asString, fail } from "./parse-shape.js";

export type {
  Cascade,
  ConstantLayer,
  Layer,
  ReplacingLayer,
  Valued,
} from "./cascade.js";
export { cascade, isCascade, layer, replace, whenever } from "./cascade.js";

export type { ValuedStream } from "./valued-stream.js";

export { resolve } from "./resolve.js";

export type { PlainRule } from "./plain-forms.js";

export type { Schedule } from "./schedule.js";
export { schedule } from "./schedule.js";

export type { Rota } from "./rota.js";
export { rota } from "./rota.js";

export type { Search } from "./query.js";
export { activeAt, advanceBy, elapsed, next } from "./query.js";
