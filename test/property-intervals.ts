import { assertNonNullable, assertTrue } from "@kensio/smartass";
import fc from "fast-check";
import type { Interval } from "../src/interval.js";

/** Generates normalized inputs without using the interval operations under test. */
export const intervalSet = fc
  .uniqueArray(fc.integer({ min: -32, max: 32 }), { maxLength: 16 })
  .map((points): Interval[] => {
    const sorted = points.toSorted((a, b) => a - b);
    const result: Interval[] = [];
    for (let index = 1; index < sorted.length; index += 2) {
      const start = sorted[index - 1];
      const end = sorted[index];
      assertNonNullable(start);
      assertNonNullable(end);
      result.push({ start: instant(start), end: instant(end) });
    }
    return result;
  });

function instant(offset: number): Temporal.ZonedDateTime {
  return new Temporal.ZonedDateTime(BigInt(offset), "UTC");
}

/** Compares instants explicitly; Temporal objects have no enumerable time fields. */
export function endpoints(source: Iterable<Interval>): unknown[] {
  return Array.from(source, ({ start, end }) => [
    start?.epochNanoseconds,
    end?.epochNanoseconds,
  ]);
}

export function includesPoint(
  source: readonly Interval[],
  at: bigint,
): boolean {
  return source.some(
    ({ start, end }) =>
      (start === undefined || start.epochNanoseconds <= at) &&
      (end === undefined || at < end.epochNanoseconds),
  );
}

export function assertNormalized(source: readonly Interval[]): void {
  let previous: Interval | undefined;
  for (const interval of source) {
    const { start, end } = interval;
    assertTrue(
      start === undefined ||
        end === undefined ||
        start.epochNanoseconds < end.epochNanoseconds,
    );
    if (previous !== undefined) {
      assertNonNullable(previous.end);
      assertNonNullable(start);
      assertTrue(previous.end.epochNanoseconds < start.epochNanoseconds);
    }
    previous = interval;
  }
}
