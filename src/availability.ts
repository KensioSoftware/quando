import { slotStream, fitAtStart } from "./slot-stream.js";
import { requireWindowEnd } from "./context.js";
/** Finding usable intervals within the time something covers. */

import { type CoverageSource, covered } from "./assigned.js";
import type { Context, QueryWindow } from "./context.js";
import { asDuration, type DurationInput } from "./duration-input.js";
import { refuse, unknownIn, upTo } from "./horizon-guard.js";
import type { Interval } from "./interval.js";
import { checkExactDuration } from "./query-validation.js";
import {
  boundSearch,
  SearchLimitExceededError,
  type Search,
} from "./search.js";

/** A fitted slot with definite endpoints. */
export interface Slot extends Interval {
  readonly start: Temporal.ZonedDateTime;
  readonly end: Temporal.ZonedDateTime;
}

/** The cadence and length of candidate intervals. */
export interface SlotOptions {
  /** The exact elapsed time between candidate starts. */
  readonly every: DurationInput;
  /** The exact elapsed time each candidate lasts. */
  readonly lasting: DurationInput;
}

/**
 * The first interval of the requested length that fits inside covered time.
 *
 * The returned interval begins at the start of the first covered interval
 * long enough to hold it. An automatic search uses the same safety limit as
 * {@link nextCoveredInterval}.
 */
export function firstAvailableSlot<V>(
  covers: CoverageSource<V>,
  lasting: DurationInput,
  context: Context & Pick<Search, "within">,
): Slot | undefined {
  const length = asDuration(lasting);
  checkPositiveDuration(length, "firstAvailableSlot()", "lasting");
  const window = boundSearch(context, context);

  for (const interval of covered(covers, window.context)) {
    const gap = fitAtStart(interval, length);
    if (gap !== undefined) {
      const fog = unknownIn(covers, upTo(window.context, gap.end));
      if (fog !== undefined) {
        refuse("firstAvailableSlot()", fog, window.context);
      }
      return gap;
    }
  }

  const fog = unknownIn(covers, window.context);
  if (fog !== undefined) {
    refuse("firstAvailableSlot()", fog, window.context);
  }
  if (window.automaticLimit !== undefined) {
    throw new SearchLimitExceededError(
      "firstAvailableSlot()",
      window.automaticLimit,
    );
  }
  return undefined;
}

/**
 * Candidate intervals that fit wholly inside covered time.
 *
 * Each covered interval starts its own cadence. The finite iterator is consumed once.
 */
export function availableSlots<V>(
  covers: CoverageSource<V>,
  context: QueryWindow,
  options: SlotOptions,
): Iterable<Slot> {
  requireWindowEnd(context, "availableSlots() needs a finite window with to.");
  const every = asDuration(options.every);
  const lasting = asDuration(options.lasting);
  checkPositiveDuration(every, "availableSlots()", "every");
  checkPositiveDuration(lasting, "availableSlots()", "lasting");
  const fog = unknownIn(covers, context);
  if (fog !== undefined) {
    refuse("availableSlots()", fog, context);
  }
  return slotStream(covered(covers, context), { every, lasting });
}

function checkPositiveDuration(
  duration: Temporal.Duration,
  operation: string,
  option: string,
): void {
  checkExactDuration(duration, operation);
  if (duration.sign <= 0) {
    throw new RangeError(
      `${operation} needs a positive \`${option}\` duration. Asked for ${duration.toString()}.`,
    );
  }
}
