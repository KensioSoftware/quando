/**
 * Holding a third-party stream to the contract the sweeps depend on.
 *
 * [interval-stream.ts](./interval-stream.ts) states it: ascending by start,
 * non-overlapping, coalesced. Every stream Quando builds satisfies it by
 * construction. A stream a `custom` rule type produces is the one place that
 * cannot be assumed, and a producer that breaks the contract gets wrong
 * answers rather than errors.
 *
 * Two of the three faults are repairable and one is not. Touching intervals
 * are merged by the union the caller wraps this in. Sorting an out-of-order
 * stream, or splitting an overlap, needs the whole stream in memory, which
 * would give up the laziness the contract is for. So those are refused, by
 * name, at the interval that broke it.
 */

import { type Interval, isEmpty, startsBeforeEnd } from "./interval.js";
import type { IntervalStream } from "./interval-stream.js";

/** A custom rule type's own stream broke the contract it was given. */
export class CustomRuleStreamError extends RangeError {
  /** The name the rule document looked its type up by. */
  public readonly ruleName: string;

  public constructor(ruleName: string, problem: string) {
    super(
      `The custom rule "${ruleName}" produced intervals that ${problem}. ` +
        "A stream is read once, in ascending order of start, so it cannot be " +
        "sorted or de-overlapped on the way through. Yield each interval " +
        "after the one before it has ended.",
    );
    this.name = "CustomRuleStreamError";
    this.ruleName = ruleName;
  }
}

/**
 * Passes a stream through, refusing what cannot be repaired lazily.
 *
 * An empty interval is dropped rather than refused, on the same reasoning the
 * sweeps drop one. It covers no time and says nothing.
 */
export function* ascending(
  stream: IntervalStream,
  ruleName: string,
): Iterable<Interval> {
  let previousEnd: Temporal.ZonedDateTime | undefined;
  let started = false;

  for (const interval of stream) {
    if (isEmpty(interval)) {
      continue;
    }
    if (started && startsBeforeEnd(interval.start, previousEnd)) {
      throw new CustomRuleStreamError(
        ruleName,
        previousEnd === undefined
          ? "follow one that runs to the unbounded future"
          : "overlap or run backwards",
      );
    }
    yield interval;
    previousEnd = interval.end;
    started = true;
  }
}
