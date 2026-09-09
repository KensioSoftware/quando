import { inWindow, render } from "#test/intervals.js";
import {
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
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

  it("joins two nights the missing hour ran together", () => {
    // Given a window from 02:00 to 01:00 the next day, over the morning
    // London loses an hour. The gap between one night and the next is exactly
    // the 01:00 to 02:00 that does not exist on 2026-03-29, so those two
    // nights are one unbroken stretch of real time.
    const week = inWindow("2026-03-27T00:00", "2026-04-03T00:00");

    // When the window is generated across it.
    const windows = timeOfDayIntervals(week, "02:00", "01:00");

    // Then the nights of the 28th and the 29th arrive as one interval, and
    // every other night arrives on its own. The stream contract says a
    // producer coalesces, and this is the only place two of these can touch.
    assertIdentical(
      render(windows),
      "[2026-03-26T02:00:00,2026-03-27T01:00:00) " +
        "[2026-03-27T02:00:00,2026-03-28T01:00:00) " +
        "[2026-03-28T02:00:00,2026-03-30T01:00:00) " +
        "[2026-03-30T02:00:00,2026-03-31T01:00:00) " +
        "[2026-03-31T02:00:00,2026-04-01T01:00:00) " +
        "[2026-04-01T02:00:00,2026-04-02T01:00:00) " +
        "[2026-04-02T02:00:00,2026-04-03T01:00:00)",
    );
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
