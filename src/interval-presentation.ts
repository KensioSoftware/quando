import type { IntervalStream } from "./interval-stream.js";

/**
 * A stream read back in one zone and calendar, as {@link intervals} promises.
 *
 * Exported for [bounds.ts](./bounds.ts), which owes its callers the same
 * promise and reaches the leaves by its own route.
 */
export function* readIn(
  stream: IntervalStream,
  zone: string,
  calendar: string,
): IntervalStream {
  for (const interval of stream) {
    yield {
      start: interval.start?.withTimeZone(zone).withCalendar(calendar),
      end: interval.end?.withTimeZone(zone).withCalendar(calendar),
    };
  }
}
