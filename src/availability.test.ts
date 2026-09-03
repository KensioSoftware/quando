import { inWindow, render } from "#test/intervals.js";
import {
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { firstGap, slots } from "./availability.js";
import { all, any, dates, timeOfDay } from "./build.js";
import { SearchLimitExceededError } from "./search.js";
import { take } from "./stream.js";

describe("finding available time", () => {
  const minutes = (count: number): Temporal.Duration =>
    Temporal.Duration.from({ minutes: count });

  const twoOpenings = () =>
    any(
      all(dates("2026-03-09"), timeOfDay("09:00", "10:00")),
      all(dates("2026-03-10"), timeOfDay("09:00", "12:00")),
    );

  describe("firstGap", () => {
    it("skips covered intervals that are too short", () => {
      // Given one hour on Monday and three hours on Tuesday.
      // When the first two-hour gap is requested.
      const found = firstGap(
        twoOpenings(),
        minutes(120),
        inWindow("2026-03-09T00:00", "2026-03-11T00:00"),
      );

      // Then the Tuesday opening supplies the gap.
      assertIdentical(
        render(found === undefined ? [] : [found]),
        "[2026-03-10T09:00:00,2026-03-10T11:00:00)",
      );
    });

    it("uses the asking time when it falls inside availability", () => {
      // Given a search beginning halfway through a three-hour opening.
      const opening = all(dates("2026-03-09"), timeOfDay("09:00", "12:00"));

      // When an hour-long gap is requested.
      const found = firstGap(
        opening,
        minutes(60),
        inWindow("2026-03-09T10:30", "2026-03-09T12:00"),
      );

      // Then the gap begins at the search boundary.
      assertIdentical(
        render(found === undefined ? [] : [found]),
        "[2026-03-09T10:30:00,2026-03-09T11:30:00)",
      );
    });

    it("accepts an exact fit", () => {
      // Given an opening with exactly one hour left in the search.
      // When a one-hour gap is requested.
      const found = firstGap(
        twoOpenings(),
        minutes(60),
        inWindow("2026-03-09T09:00", "2026-03-09T10:00"),
      );

      // Then the whole opening is returned.
      assertIdentical(
        render(found === undefined ? [] : [found]),
        "[2026-03-09T09:00:00,2026-03-09T10:00:00)",
      );
    });

    it("returns undefined when an explicit search has no large enough gap", () => {
      // Given an opening shorter than the requested gap and a finite window.
      // When that window is searched.
      const found = firstGap(
        twoOpenings(),
        minutes(90),
        inWindow("2026-03-09T00:00", "2026-03-10T00:00"),
      );

      // Then the finite search has no answer.
      assertUndefined(found);
    });

    it("fails safely when an automatic search has no answer", () => {
      // Given a rule that never covers time and no search horizon.
      // When a gap is requested.
      const error = assertThrowsError(() =>
        firstGap({ type: "never" }, minutes(30), inWindow("2026-03-09T00:00")),
      );

      // Then the common search safety limit is reported.
      assertInstanceOf(error, SearchLimitExceededError);
    });

    it("uses an explicit horizon without reporting a safety failure", () => {
      // Given a rule that never covers time and a caller-supplied horizon.
      // When a gap is requested inside it.
      const found = firstGap(
        { type: "never" },
        minutes(30),
        inWindow("2026-03-09T00:00"),
        { within: Temporal.Duration.from({ days: 1 }) },
      );

      // Then exhausting the expected range returns no answer.
      assertUndefined(found);
    });

    it("refuses a zero or negative gap length", () => {
      // Given lengths that cannot describe a usable gap.
      const invalid = [minutes(0), minutes(-1)];

      for (const lasting of invalid) {
        // When each length is requested.
        const error = assertThrowsError(() =>
          firstGap({ type: "always" }, lasting, inWindow("2026-03-09T00:00")),
        );

        // Then it is refused as a non-positive duration.
        assertInstanceOf(error, RangeError);
        assertStringIncludes(error.message, "positive");
      }
    });
  });

  describe("slots", () => {
    it("emits overlapping candidates at the requested cadence", () => {
      // Given an hour of availability.
      const opening = all(dates("2026-03-09"), timeOfDay("09:00", "10:00"));

      // When half-hour slots are placed every fifteen minutes.
      const found = slots(
        opening,
        inWindow("2026-03-09T00:00", "2026-03-10T00:00"),
        { every: minutes(15), lasting: minutes(30) },
      );

      // Then only candidates that fit wholly inside the opening are returned.
      assertIdentical(
        render(found),
        "[2026-03-09T09:00:00,2026-03-09T09:30:00) " +
          "[2026-03-09T09:15:00,2026-03-09T09:45:00) " +
          "[2026-03-09T09:30:00,2026-03-09T10:00:00)",
      );
    });

    it("starts a fresh cadence for each covered interval", () => {
      // Given two openings on consecutive days.
      // When forty-minute slots are placed every half-hour.
      const found = slots(
        twoOpenings(),
        inWindow("2026-03-09T00:00", "2026-03-11T00:00"),
        { every: minutes(30), lasting: minutes(40) },
      );

      // Then each day's first candidate begins when that opening begins.
      assertIdentical(
        render(found),
        "[2026-03-09T09:00:00,2026-03-09T09:40:00) " +
          "[2026-03-10T09:00:00,2026-03-10T09:40:00) " +
          "[2026-03-10T09:30:00,2026-03-10T10:10:00) " +
          "[2026-03-10T10:00:00,2026-03-10T10:40:00) " +
          "[2026-03-10T10:30:00,2026-03-10T11:10:00) " +
          "[2026-03-10T11:00:00,2026-03-10T11:40:00)",
      );
    });

    it("stays lazy over availability with no end", () => {
      // Given availability that covers the unbounded future.
      const candidates = slots(
        { type: "always" },
        inWindow("2026-03-09T09:00"),
        { every: minutes(15), lasting: minutes(30) },
      );

      // When three candidates are taken.
      const found = take(candidates, 3);

      // Then those candidates arrive without trying to finish the stream.
      assertIdentical(
        render(found),
        "[2026-03-09T09:00:00,2026-03-09T09:30:00) " +
          "[2026-03-09T09:15:00,2026-03-09T09:45:00) " +
          "[2026-03-09T09:30:00,2026-03-09T10:00:00)",
      );
    });

    it("refuses calendar units for either duration", () => {
      // Given slot options whose lengths depend on the calendar.
      const oneDay = Temporal.Duration.from({ days: 1 });
      const invalid = [
        { every: oneDay, lasting: minutes(30) },
        { every: minutes(15), lasting: oneDay },
      ];

      for (const options of invalid) {
        // When each option is used.
        const error = assertThrowsError(() =>
          slots({ type: "always" }, inWindow("2026-03-09T09:00"), options),
        );

        // Then the ambiguous calendar duration is refused.
        assertInstanceOf(error, RangeError);
        assertStringIncludes(error.message, "calendar units");
      }
    });

    it("refuses a zero cadence before iteration begins", () => {
      // Given a cadence that could never advance the stream.
      // When slots are created from it.
      const error = assertThrowsError(() =>
        slots({ type: "always" }, inWindow("2026-03-09T09:00"), {
          every: minutes(0),
          lasting: minutes(30),
        }),
      );

      // Then the invalid cadence is refused immediately.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, "every");
    });
  });
});
