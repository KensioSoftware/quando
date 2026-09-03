/** Low-level interval, cascade, and evaluation APIs. */

export * from "./index.js";

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
export { intervals } from "./interpret.js";

export type {
  Cascade,
  CascadeLike,
  ConstantLayer,
  HasCascade,
  Layer,
  ReplacingLayer,
  Valued,
} from "./cascade.js";
export {
  asCascade,
  cascade,
  isCascade,
  layer,
  merged,
  replace,
  whenever,
} from "./cascade.js";
export type { Merge, MergeStrategy } from "./merge.js";
export { MERGE_STRATEGIES } from "./merge.js";
export type { ValuedStream } from "./valued-stream.js";
export { overlay } from "./valued-stream.js";
export { resolve } from "./resolve.js";

export type { Assigned, Covers } from "./assigned.js";
export { assigned, nextValue, valueAt } from "./assigned.js";
export type {
  AllRule,
  AlwaysRule,
  AnyRule,
  DatesRule,
  DaysOfWeekRule,
  InZoneRule,
  NeverRule,
  NotRule,
  TimeOfDayRule,
} from "./rule.js";
