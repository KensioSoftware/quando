import { dailyForever, metered, render, span } from "#test/intervals.js";
import {
  assertArrayLength,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { clip, complement, intersect, union } from "./interval-stream.js";
import { take } from "./stream.js";
import { duration } from "./interval.js";

const MARCH = span("2026-03-01T00:00", "2026-04-01T00:00");

describe("intersect", () => {
  it("keeps only the overlap", () => {
    const left = [span("2026-03-16T09:00", "2026-03-16T17:00")];
    const right = [span("2026-03-16T12:00", "2026-03-16T20:00")];
    assertIdentical(
      render(intersect(left, right)),
      "[2026-03-16T12:00:00,2026-03-16T17:00:00)",
    );
  });

  it("yields nothing for disjoint streams", () => {
    const left = [span("2026-03-16T09:00", "2026-03-16T12:00")];
    const right = [span("2026-03-16T13:00", "2026-03-16T17:00")];
    assertIdentical(render(intersect(left, right)), "");
  });

  it("yields nothing for merely touching streams, since intervals are half open", () => {
    const left = [span("2026-03-16T09:00", "2026-03-16T12:00")];
    const right = [span("2026-03-16T12:00", "2026-03-16T17:00")];
    assertIdentical(render(intersect(left, right)), "");
  });

  it("matches one long interval against several short ones", () => {
    const long = [span("2026-03-16T00:00", "2026-03-18T00:00")];
    const short = [
      span("2026-03-16T09:00", "2026-03-16T17:00"),
      span("2026-03-17T09:00", "2026-03-17T17:00"),
      span("2026-03-19T09:00", "2026-03-19T17:00"),
    ];
    assertIdentical(
      render(intersect(long, short)),
      "[2026-03-16T09:00:00,2026-03-16T17:00:00) [2026-03-17T09:00:00,2026-03-17T17:00:00)",
    );
  });

  it("treats an unbounded stream as covering everything", () => {
    const everything = [span(undefined, undefined)];
    const hours = [span("2026-03-16T09:00", "2026-03-16T17:00")];
    assertIdentical(
      render(intersect(everything, hours)),
      "[2026-03-16T09:00:00,2026-03-16T17:00:00)",
    );
  });

  it("terminates on an empty result once its sources are bounded", () => {
    // Two infinite streams that never overlap. Unbounded, this would sweep
    // forever — there is nothing either could inspect to learn the answer is
    // empty. Clipped, the inputs run out and so does the sweep.
    const mornings = clip(dailyForever("2026-03-01", "09:00", "12:00"), MARCH);
    const evenings = clip(dailyForever("2026-03-01", "18:00", "21:00"), MARCH);
    assertIdentical(render(intersect(mornings, evenings)), "");
  });
});

describe("union", () => {
  it("merges overlapping intervals", () => {
    const left = [span("2026-03-16T09:00", "2026-03-16T13:00")];
    const right = [span("2026-03-16T12:00", "2026-03-16T17:00")];
    assertIdentical(
      render(union(left, right)),
      "[2026-03-16T09:00:00,2026-03-16T17:00:00)",
    );
  });

  it("merges merely touching intervals, so the output stays coalesced", () => {
    const left = [span("2026-03-16T09:00", "2026-03-16T12:00")];
    const right = [span("2026-03-16T12:00", "2026-03-16T17:00")];
    assertIdentical(
      render(union(left, right)),
      "[2026-03-16T09:00:00,2026-03-16T17:00:00)",
    );
  });

  it("keeps disjoint intervals apart and in order", () => {
    const left = [span("2026-03-16T09:00", "2026-03-16T12:00")];
    const right = [span("2026-03-16T13:00", "2026-03-16T17:00")];
    assertIdentical(
      render(union(left, right)),
      "[2026-03-16T09:00:00,2026-03-16T12:00:00) [2026-03-16T13:00:00,2026-03-16T17:00:00)",
    );
  });

  it("drains whichever side outlasts the other", () => {
    const left = [span("2026-03-16T09:00", "2026-03-16T10:00")];
    const right = [
      span("2026-03-16T11:00", "2026-03-16T12:00"),
      span("2026-03-16T13:00", "2026-03-16T14:00"),
    ];
    assertIdentical(
      render(union(left, right)),
      "[2026-03-16T09:00:00,2026-03-16T10:00:00) " +
        "[2026-03-16T11:00:00,2026-03-16T12:00:00) " +
        "[2026-03-16T13:00:00,2026-03-16T14:00:00)",
    );
  });

  it("absorbs everything into an unbounded interval", () => {
    const open = [span("2026-03-16T09:00", undefined)];
    const later = [span("2026-03-20T09:00", "2026-03-20T17:00")];
    assertIdentical(render(union(open, later)), "[2026-03-16T09:00:00,*)");
  });

  it("takes from the right when it leads, and keeps draining it", () => {
    const left = [span("2026-03-16T15:00", "2026-03-16T16:00")];
    const right = [
      span("2026-03-16T09:00", "2026-03-16T10:00"),
      span("2026-03-16T11:00", "2026-03-16T12:00"),
    ];
    assertIdentical(
      render(union(left, right)),
      "[2026-03-16T09:00:00,2026-03-16T10:00:00) " +
        "[2026-03-16T11:00:00,2026-03-16T12:00:00) " +
        "[2026-03-16T15:00:00,2026-03-16T16:00:00)",
    );
  });

  it("is empty for two empty streams", () => {
    assertIdentical(render(union([], [])), "");
  });
});

describe("complement", () => {
  it("returns the gaps, unbounded at both ends", () => {
    const covered = [
      span("2026-03-16T09:00", "2026-03-16T17:00"),
      span("2026-03-17T09:00", "2026-03-17T17:00"),
    ];
    assertIdentical(
      render(complement(covered)),
      "[*,2026-03-16T09:00:00) " +
        "[2026-03-16T17:00:00,2026-03-17T09:00:00) " +
        "[2026-03-17T17:00:00,*)",
    );
  });

  it("has nothing before a source that begins at the unbounded past", () => {
    const covered = [span(undefined, "2026-03-16T09:00")];
    assertIdentical(render(complement(covered)), "[2026-03-16T09:00:00,*)");
  });

  it("has nothing after a source that runs to the unbounded future", () => {
    const covered = [span("2026-03-16T09:00", undefined)];
    assertIdentical(render(complement(covered)), "[*,2026-03-16T09:00:00)");
  });

  it("is everything for an empty source", () => {
    assertIdentical(render(complement([])), "[*,*)");
  });

  it("is nothing for a source that covers everything", () => {
    const everything = [span(undefined, undefined)];
    assertIdentical(render(complement(everything)), "");
  });

  it("round-trips when applied twice", () => {
    const covered = [
      span("2026-03-16T09:00", "2026-03-16T17:00"),
      span("2026-03-17T09:00", "2026-03-17T17:00"),
    ];
    const roundTripped = complement(complement(covered));
    assertIdentical(render(roundTripped), render(covered));
  });
});

describe("clip", () => {
  it("trims intervals to the window", () => {
    const source = [span("2026-03-16T00:00", "2026-03-20T00:00")];
    const window = span("2026-03-17T00:00", "2026-03-18T00:00");
    assertIdentical(
      render(clip(source, window)),
      "[2026-03-17T00:00:00,2026-03-18T00:00:00)",
    );
  });

  it("drops intervals outside the window entirely", () => {
    const source = [
      span("2026-03-01T09:00", "2026-03-01T17:00"),
      span("2026-03-17T09:00", "2026-03-17T17:00"),
      span("2026-03-30T09:00", "2026-03-30T17:00"),
    ];
    const window = span("2026-03-10T00:00", "2026-03-20T00:00");
    assertIdentical(
      render(clip(source, window)),
      "[2026-03-17T09:00:00,2026-03-17T17:00:00)",
    );
  });

  it("stops early rather than draining an infinite source", () => {
    const meter = metered(dailyForever("2026-03-01", "09:00", "17:00"));
    const window = span("2026-03-01T00:00", "2026-03-04T00:00");
    const clipped = [...clip(meter.stream, window)];

    assertArrayLength(clipped, 3);
    // Three results, plus the one interval that proved the window was past.
    assertIdentical(meter.pulled(), 4);
  });

  it("passes everything through an unbounded window", () => {
    const source = [span("2026-03-16T09:00", "2026-03-16T17:00")];
    const everywhen = span(undefined, undefined);
    assertIdentical(
      render(clip(source, everywhen)),
      "[2026-03-16T09:00:00,2026-03-16T17:00:00)",
    );
  });
});

describe("take", () => {
  const source = [
    span("2026-03-16T09:00", "2026-03-16T17:00"),
    span("2026-03-17T09:00", "2026-03-17T17:00"),
  ];

  it("takes nothing for a count of zero or less", () => {
    assertArrayLength(take(source, 0), 0);
    assertArrayLength(take(source, -1), 0);
  });

  it("takes fewer than asked when the source is short", () => {
    assertArrayLength(take(source, 10), 2);
  });

  it("takes exactly the count asked", () => {
    assertArrayLength(take(source, 1), 1);
  });
});

describe("laziness", () => {
  it("pulls barely more than it yields from an infinite intersection", () => {
    const meter = metered(dailyForever("2026-03-01", "09:00", "17:00"));
    const window = [span("2026-03-01T00:00", "2027-01-01T00:00")];
    const taken = take(intersect(meter.stream, window), 3);

    assertArrayLength(taken, 3);
    // A year's window against a daily recurrence: sampling would be hundreds of
    // steps. Anything in single figures means the sweep is genuinely lazy.
    assertTrue(meter.pulled() <= 4);
  });

  it("does not expand an infinite source to complement it", () => {
    const meter = metered(dailyForever("2026-03-01", "09:00", "17:00"));
    const gaps = take(complement(meter.stream), 2);

    assertArrayLength(gaps, 2);
    assertTrue(meter.pulled() <= 3);
  });
});

describe("composition over a daylight saving transition", () => {
  it("keeps wall-clock hours while measuring exact elapsed time", () => {
    // Clocks go forward at 01:00 on 2026-03-29, outside office hours, so every
    // day is eight hours long even though one of them is 23 hours.
    const week = span("2026-03-27T00:00", "2026-03-31T00:00");
    const hours = [...clip(dailyForever("2026-03-27", "09:00", "17:00"), week)];

    assertArrayLength(hours, 4);
    for (const day of hours) {
      assertIdentical(duration(day)?.toString(), "PT8H");
    }
  });

  it("reports exact elapsed time for an interval spanning the transition", () => {
    const overnight = [span("2026-03-29T00:00", "2026-03-29T06:00")];
    const maintenance = [span("2026-03-28T22:00", "2026-03-29T12:00")];

    const overlap = [...intersect(overnight, maintenance)];

    assertArrayLength(overlap, 1);
    // Six hours on the clock, five in real elapsed time.
    assertIdentical(duration(overlap[0])?.toString(), "PT5H");
  });
});
