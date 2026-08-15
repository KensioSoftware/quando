import { inWindow } from "#test/intervals.js";
import { assertArrayLength, assertTrue } from "@kensio/smartass";
import { describe, it } from "vitest";

import { isEmpty } from "./interval.js";
import { timeOfDayIntervals } from "./time-rules.js";

/**
 * Tested against the generator rather than through `intervals`, because the
 * clipping that composition applies would filter an empty interval out and
 * hide the fault. The contract belongs to the generator.
 */
describe("the time-of-day generator's own output", () => {
  it("emits no zero-length window when the clocks go forward", () => {
    // 01:00 does not exist in London on 2026-03-29: the hour is skipped, and
    // Temporal resolves a nonexistent wall time forward to the far side of the
    // gap. That makes both ends of 01:00-02:00 the same instant.
    const dstDay = inWindow("2026-03-29T00:00", "2026-03-30T00:00");
    const windows = [...timeOfDayIntervals(dstDay, "01:00", "02:00")];

    for (const window of windows) {
      assertTrue(!isEmpty(window), "a zero-length window reached the stream");
    }
  });

  it("still emits the windows either side of that morning", () => {
    const threeDays = inWindow("2026-03-28T00:00", "2026-03-31T00:00");
    const windows = [...timeOfDayIntervals(threeDays, "01:00", "02:00")];

    // The 28th, the 30th, and the day before the window that clipping drops —
    // the 29th is the one that collapses and is skipped.
    assertTrue(windows.length >= 2, "the surrounding days should still appear");
    for (const window of windows) {
      assertTrue(!isEmpty(window));
    }
  });

  it("is unaffected on an ordinary day", () => {
    const oneDay = inWindow("2026-03-16T00:00", "2026-03-17T00:00");
    const windows = [...timeOfDayIntervals(oneDay, "01:00", "02:00")];

    // The generator starts a day early for wrapping windows, so the day before
    // is included too.
    assertArrayLength(windows, 2);
  });
});
