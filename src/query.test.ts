import { inWindow, when } from "#test/intervals.js";
import {
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { dates, timeOfDay, weekdays } from "./build.js";
import { activeAt, advanceBy, elapsed, next } from "./query.js";
import type { Rule } from "./rule.js";

const OPEN: Rule = weekdays().and(timeOfDay("09:00", "17:00"));
const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");
const hours = (count: number): Temporal.Duration =>
  Temporal.Duration.from({ hours: count });

describe("activeAt", () => {
  it("is true inside an opening", () => {
    assertTrue(activeAt(OPEN, when("2026-03-09T10:00")));
  });

  it("is true exactly at the start, which the interval includes", () => {
    assertTrue(activeAt(OPEN, when("2026-03-09T09:00")));
  });

  it("is false exactly at the end, which the interval excludes", () => {
    assertFalse(activeAt(OPEN, when("2026-03-09T17:00")));
  });

  it("is false at the weekend", () => {
    assertFalse(activeAt(OPEN, when("2026-03-14T10:00")));
  });

  it("terminates even for a rule that covers nothing at all", () => {
    // No window is given, so a search for the next opening would run forever.
    // Asking about one instant cannot: there is nowhere for it to look.
    assertFalse(activeAt({ type: "never" }, when("2026-03-09T10:00")));
  });
});

describe("elapsed", () => {
  it("adds up the time a rule covers", () => {
    // Five working days of eight hours.
    assertIdentical(elapsed(OPEN, WEEK).toString(), "PT40H");
  });

  it("counts nothing for a rule that covers nothing", () => {
    assertIdentical(elapsed({ type: "never" }, WEEK).toString(), "PT0S");
  });

  it("measures real elapsed time across a clock change", () => {
    // The whole of the day the clocks go forward: 23 hours, not 24.
    const springForward = inWindow("2026-03-29T00:00", "2026-03-30T00:00");
    assertIdentical(
      elapsed({ type: "always" }, springForward).toString(),
      "PT23H",
    );
  });

  it("refuses a window with no end", () => {
    const error = assertThrowsError(() =>
      elapsed(OPEN, inWindow("2026-03-09T00:00")),
    );
    assertInstanceOf(error, RangeError);
  });
});

describe("next", () => {
  it("finds the next opening", () => {
    const found = next(OPEN, inWindow("2026-03-09T06:00"));
    assertIdentical(
      found?.start?.toPlainDateTime().toString(),
      "2026-03-09T09:00:00",
    );
  });

  it("says it is open now, rather than skipping to tomorrow", () => {
    const found = next(OPEN, inWindow("2026-03-09T10:00"));
    assertIdentical(
      found?.start?.toPlainDateTime().toString(),
      "2026-03-09T10:00:00",
    );
  });

  it("crosses the weekend", () => {
    const found = next(OPEN, inWindow("2026-03-14T10:00"));
    assertIdentical(
      found?.start?.toPlainDateTime().toString(),
      "2026-03-16T09:00:00",
    );
  });

  it("finds nothing within a search that is too short", () => {
    const found = next(OPEN, inWindow("2026-03-14T10:00"), {
      within: Temporal.Duration.from({ hours: 12 }),
    });
    assertUndefined(found);
  });

  it("lets `within` narrow a window but never widen it", () => {
    // The context says the caller cares about Saturday morning only. A generous
    // `within` must not talk them into an answer from Monday.
    const saturdayMorning = inWindow("2026-03-14T10:00", "2026-03-14T12:00");
    const found = next(OPEN, saturdayMorning, {
      within: Temporal.Duration.from({ days: 7 }),
    });
    assertUndefined(found);
  });

  it("finds it once the search is long enough", () => {
    const found = next(OPEN, inWindow("2026-03-14T10:00"), {
      within: Temporal.Duration.from({ days: 3 }),
    });
    assertIdentical(
      found?.start?.toPlainDateTime().toString(),
      "2026-03-16T09:00:00",
    );
  });
});

describe("advanceBy", () => {
  it("counts only the hours the rule covers", () => {
    // Two hours from 16:00 on a Monday: one before closing, one after opening.
    const reached = advanceBy(when("2026-03-09T16:00"), hours(2), {
      during: OPEN,
    });
    assertIdentical(
      reached?.toPlainDateTime().toString(),
      "2026-03-10T10:00:00",
    );
  });

  it("carries a whole day's worth over into the next", () => {
    const reached = advanceBy(when("2026-03-09T09:00"), hours(12), {
      during: OPEN,
    });
    assertIdentical(
      reached?.toPlainDateTime().toString(),
      "2026-03-10T13:00:00",
    );
  });

  it("crosses a weekend, which is the case people get wrong by hand", () => {
    // Three operating hours from five to five on a Friday.
    const reached = advanceBy(when("2026-03-13T16:55"), hours(3), {
      during: OPEN,
    });
    assertIdentical(
      reached?.toPlainDateTime().toString(),
      "2026-03-16T11:55:00",
    );
  });

  it("skips a holiday as well as the weekend", () => {
    const openExceptTuesday = weekdays()
      .and(timeOfDay("09:00", "17:00"))
      .except(dates("2026-03-10"));

    const reached = advanceBy(when("2026-03-09T16:00"), hours(2), {
      during: openExceptTuesday,
    });
    assertIdentical(
      reached?.toPlainDateTime().toString(),
      "2026-03-11T10:00:00",
    );
  });

  it("stays put when nothing is asked for and the clock is already running", () => {
    const reached = advanceBy(when("2026-03-09T10:00"), hours(0), {
      during: OPEN,
    });
    assertIdentical(
      reached?.toPlainDateTime().toString(),
      "2026-03-09T10:00:00",
    );
  });

  it("moves to the next opening when nothing is asked for and it is shut", () => {
    const reached = advanceBy(when("2026-03-14T10:00"), hours(0), {
      during: OPEN,
    });
    assertIdentical(
      reached?.toPlainDateTime().toString(),
      "2026-03-16T09:00:00",
    );
  });

  it("gives up when the search runs out before the time does", () => {
    const reached = advanceBy(when("2026-03-09T09:00"), hours(100), {
      during: OPEN,
      within: Temporal.Duration.from({ days: 3 }),
    });
    assertUndefined(reached);
  });

  it("refuses calendar units, which do not mean one fixed length of time", () => {
    // `P1D` would be compared as 24 hours and then added as a calendar day,
    // which are an hour apart on the morning the clocks change.
    for (const ambiguous of [
      Temporal.Duration.from({ days: 1 }),
      Temporal.Duration.from({ weeks: 1 }),
      Temporal.Duration.from({ months: 1 }),
      Temporal.Duration.from({ years: 1 }),
    ]) {
      const error = assertThrowsError(() =>
        advanceBy(when("2026-03-29T00:00"), ambiguous, {
          during: { type: "always" },
        }),
      );
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, "calendar units");
    }
  });

  it("takes the exact equivalent happily", () => {
    const reached = advanceBy(when("2026-03-29T00:00"), hours(24), {
      during: { type: "always" },
    });
    assertIdentical(
      reached?.toPlainDateTime().toString(),
      "2026-03-30T01:00:00",
    );
  });

  it("refuses to go backwards", () => {
    const error = assertThrowsError(() =>
      advanceBy(when("2026-03-09T10:00"), hours(-1), { during: OPEN }),
    );
    assertInstanceOf(error, RangeError);
  });

  it("measures exact time, so a clock change does not lose an hour", () => {
    // Open all day. Twenty-four hours from midnight on the day the clocks go
    // forward is 01:00 the next morning, because that day was only 23 long.
    const reached = advanceBy(when("2026-03-29T00:00"), hours(24), {
      during: { type: "always" },
    });
    assertIdentical(
      reached?.toPlainDateTime().toString(),
      "2026-03-30T01:00:00",
    );
  });
});
