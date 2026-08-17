import { inWindow } from "#test/intervals.js";
import { assertArrayLength, assertFalse, assertTrue } from "@kensio/smartass";
import { describe, it } from "vitest";

import { isEmpty } from "./interval.js";
import { timeOfDayIntervals } from "./time-rules.js";

/**
 * Tested against the generator directly. Composition clips its output, and
 * clipping would filter an empty interval out and hide the fault. The contract
 * belongs to the generator.
 */
describe("the time-of-day generator's own output", () => {
  it("emits no zero-length window when the clocks go forward", () => {
    // Given the morning London loses an hour. 01:00 has no instant on
    // 2026-03-29, and Temporal resolves a nonexistent wall time forward to the
    // far side of the gap. Both ends of 01:00-02:00 land together.
    const dstDay = inWindow("2026-03-29T00:00", "2026-03-30T00:00");

    // When the window that collapses is generated over that day.
    const windows = [...timeOfDayIntervals(dstDay, "01:00", "02:00")];

    // Then every window that arrives covers some time.
    for (const window of windows) {
      assertFalse(isEmpty(window), "a zero-length window reached the stream");
    }
  });

  it("still emits the windows either side of that morning", () => {
    // Given the clock change with an ordinary day on each side of it.
    const threeDays = inWindow("2026-03-28T00:00", "2026-03-31T00:00");

    // When the same window is generated across all three.
    const windows = [...timeOfDayIntervals(threeDays, "01:00", "02:00")];

    // Then the 28th and the 30th are both there. Only the 29th collapses.
    assertTrue(windows.length >= 2, "the surrounding days should still appear");
    for (const window of windows) {
      assertFalse(isEmpty(window));
    }
  });

  it("is unaffected on an ordinary day", () => {
    // Given a day with no clock change in it.
    const oneDay = inWindow("2026-03-16T00:00", "2026-03-17T00:00");

    // When the window is generated over that day.
    const windows = [...timeOfDayIntervals(oneDay, "01:00", "02:00")];

    // Then two arrive. The generator starts a day early for wrapping windows,
    // and the day before comes with it.
    assertArrayLength(windows, 2);
  });
});
