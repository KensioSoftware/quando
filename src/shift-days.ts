import type { Context } from "./context.js";
import type { IntervalStream } from "./interval-stream.js";

/** Moves an evaluation window back by calendar days. */
export function beforeShift(context: Context, days: number): Context {
  return {
    ...context,
    from: context.from.subtract({ days }),
    ...(context.to === undefined ? {} : { to: context.to.subtract({ days }) }),
  };
}

/** Moves interval boundaries forward by local calendar days. */
export function* shiftedDays(
  source: IntervalStream,
  days: number,
): IntervalStream {
  for (const interval of source) {
    yield {
      start: interval.start?.add({ days }),
      end: interval.end?.add({ days }),
    };
  }
}
