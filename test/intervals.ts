/**
 * Fixtures for building and reading intervals in tests, so that assertions read
 * as the timeline they describe rather than as Temporal construction.
 */

import type { Context } from "../src/context.js";
import type { Interval } from "../src/interval.js";

export const LONDON = "Europe/London";

/** A London time from an ISO string, without the zone suffix noise. */
export function when(
  iso: string,
  zone: string = LONDON,
): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.from(`${iso}[${zone}]`);
}

/**
 * An interval from two ISO strings. Either may be `undefined` for an unbounded
 * end, which is why they are taken as strings rather than as an object.
 */
export function span(
  start: string | undefined,
  end: string | undefined,
  zone: string = LONDON,
): Interval {
  return {
    start: start === undefined ? undefined : when(start, zone),
    end: end === undefined ? undefined : when(end, zone),
  };
}

/** A stream rendered as a single readable line, for whole-result assertions. */
export function render(intervals: Iterable<Interval>): string {
  const parts: string[] = [];
  for (const interval of intervals) {
    parts.push(`[${edge(interval.start)},${edge(interval.end)})`);
  }
  return parts.join(" ");
}

function edge(at: Temporal.ZonedDateTime | undefined): string {
  return at === undefined ? "*" : at.toPlainDateTime().toString();
}

/**
 * Wraps a stream so a test can assert on how much of it was consumed. Laziness
 * is a promise this library makes, so it is worth checking rather than assuming.
 */
export function metered(source: Iterable<Interval>): {
  stream: Iterable<Interval>;
  pulled: () => number;
} {
  let pulls = 0;
  return {
    stream: {
      *[Symbol.iterator]() {
        for (const interval of source) {
          pulls++;
          yield interval;
        }
      },
    },
    pulled: () => pulls,
  };
}

/** A daily interval, repeating forever from a date. Deliberately infinite. */
export function* dailyForever(
  fromDate: string,
  startTime: string,
  endTime: string,
  zone: string = LONDON,
): Iterable<Interval> {
  for (
    let date = Temporal.PlainDate.from(fromDate);
    ;
    date = date.add({ days: 1 })
  ) {
    yield {
      start: date.toZonedDateTime({ timeZone: zone, plainTime: startTime }),
      end: date.toZonedDateTime({ timeZone: zone, plainTime: endTime }),
    };
  }
}

/** A context over a window, for evaluating rules in tests. */
export function inWindow(
  from: string,
  to?: string,
  zone: string = LONDON,
): Context {
  return to === undefined
    ? { from: when(from, zone) }
    : { from: when(from, zone), to: when(to, zone) };
}
