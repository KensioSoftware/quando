/** Finding usable intervals within the time something covers. */

import { type Covers, covered } from "./assigned.js";
import type { Context } from "./context.js";
import type { Interval } from "./interval.js";
import type { IntervalStream } from "./interval-stream.js";
import { checkExactDuration } from "./query-validation.js";
import {
  boundSearch,
  SearchLimitExceededError,
  type Search,
} from "./search.js";

const NOTHING = Temporal.Duration.from({ seconds: 0 });

/** The cadence and length of candidate intervals. */
export interface SlotOptions {
  /** The exact elapsed time between candidate starts. */
  readonly every: Temporal.Duration;
  /** The exact elapsed time each candidate lasts. */
  readonly lasting: Temporal.Duration;
}

/**
 * The first interval of the requested length that fits inside covered time.
 *
 * The returned interval begins at the start of the first covered interval
 * long enough to hold it. An automatic search uses the same safety limit as
 * {@link nextCoveredInterval}.
 */
export function firstGap<V>(
  covers: Covers<V>,
  lasting: Temporal.Duration,
  context: Context,
  search?: Pick<Search, "within">,
): Interval | undefined {
  checkPositiveDuration(lasting, "firstGap()", "lasting");
  const window = boundSearch(context, search);

  for (const interval of covered(covers, window.context)) {
    const gap = fitAtStart(interval, lasting);
    if (gap !== undefined) {
      return gap;
    }
  }

  if (window.automaticLimit !== undefined) {
    throw new SearchLimitExceededError("firstGap()", window.automaticLimit);
  }
  return undefined;
}

/**
 * Candidate intervals that fit wholly inside covered time.
 *
 * Each covered interval starts its own cadence. The result is lazy and may be
 * infinite when the context and its source are both unbounded.
 */
export function slots<V>(
  covers: Covers<V>,
  context: Context,
  options: SlotOptions,
): IntervalStream {
  checkPositiveDuration(options.every, "slots()", "every");
  checkPositiveDuration(options.lasting, "slots()", "lasting");
  return slotStream(covered(covers, context), options);
}

function* slotStream(
  availability: Iterable<Interval>,
  options: SlotOptions,
): IntervalStream {
  for (const interval of availability) {
    if (interval.start === undefined) {
      continue;
    }

    let start = interval.start;
    for (;;) {
      const candidate = fitAtStart({ ...interval, start }, options.lasting);
      if (candidate === undefined) {
        break;
      }
      yield candidate;
      start = start.add(options.every);
    }
  }
}

function fitAtStart(
  interval: Interval,
  lasting: Temporal.Duration,
): Interval | undefined {
  if (interval.start === undefined) {
    return;
  }
  const end = interval.start.add(lasting);
  if (
    interval.end !== undefined &&
    Temporal.ZonedDateTime.compare(end, interval.end) > 0
  ) {
    return;
  }
  return { start: interval.start, end };
}

function checkPositiveDuration(
  duration: Temporal.Duration,
  operation: string,
  option: string,
): void {
  checkExactDuration(duration, operation);
  if (Temporal.Duration.compare(duration, NOTHING) <= 0) {
    throw new RangeError(
      `${operation} needs a positive \`${option}\` duration. Asked for ${duration.toString()}.`,
    );
  }
}
