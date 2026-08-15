/**
 * Quando: declarative temporal rules for schedules, deadlines, constraints and
 * exceptions.
 *
 * What exists so far is the interval core — the algebra everything else is
 * built from. Rules, cascades and queries are still to come.
 *
 * Requires a runtime with `Temporal`: Node 26 or later, or a current browser.
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
