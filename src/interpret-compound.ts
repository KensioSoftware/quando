import type { RuleData } from "./rule.js";
import { type Context, windowOf } from "./context.js";
import {
  clip,
  intersect,
  union,
  type IntervalStream,
} from "./interval-stream.js";
const UNBOUNDED: IntervalStream = [{ start: undefined, end: undefined }];
const EMPTY: IntervalStream = [];

/** Intersection, starting from all of time so that no rules means no limits. */
export function everyOf(
  rules: readonly RuleData[],
  context: Context,
  evaluate: (rule: RuleData, context: Context) => IntervalStream,
): IntervalStream {
  let covered = clip(UNBOUNDED, windowOf(context));
  for (const rule of rules) {
    covered = intersect(covered, evaluate(rule, context));
  }
  return covered;
}

/** Union, starting from nothing so that no rules means no times. */
export function anyOf(
  rules: readonly RuleData[],
  context: Context,
  evaluate: (rule: RuleData, context: Context) => IntervalStream,
): IntervalStream {
  let covered = EMPTY;
  for (const rule of rules) {
    covered = union(covered, evaluate(rule, context));
  }
  return covered;
}
