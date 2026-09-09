import type { Interval } from "./interval.js";
import type { Slot } from "./availability.js";

export function* slotStream(
  availability: Iterable<Interval>,
  options: {
    readonly every: Temporal.Duration;
    readonly lasting: Temporal.Duration;
  },
): Iterable<Slot> {
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

export function fitAtStart(
  interval: Interval,
  lasting: Temporal.Duration,
): Slot | undefined {
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
