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

describe("asking a rule questions", () => {
  /** Weekdays, nine to five. */
  const open = (): Rule => weekdays().and(timeOfDay("09:00", "17:00"));

  /** Monday 2026-03-09 to the Monday after it. */
  const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

  const hours = (count: number): Temporal.Duration =>
    Temporal.Duration.from({ hours: count });

  describe("activeAt", () => {
    it("is true inside an opening", () => {
      // Given a Monday mid-morning.
      // When the rule is asked about it.
      // Then it is covered.
      assertTrue(activeAt(open(), when("2026-03-09T10:00")));
    });

    it("is true exactly at the start, which the interval includes", () => {
      // Given nine o'clock exactly.
      // When the rule is asked about it.
      // Then it is covered. A half-open interval holds its start.
      assertTrue(activeAt(open(), when("2026-03-09T09:00")));
    });

    it("is false exactly at the end, which the interval excludes", () => {
      // Given five o'clock exactly.
      // When the rule is asked about it.
      // Then it is outside. Closing time is when it is shut.
      assertFalse(activeAt(open(), when("2026-03-09T17:00")));
    });

    it("is false at the weekend", () => {
      // Given a Saturday morning.
      // When the rule is asked about it.
      // Then no weekday claims it.
      assertFalse(activeAt(open(), when("2026-03-14T10:00")));
    });

    it("terminates even for a rule that covers nothing at all", () => {
      // Given a rule covering no time, and no window to bound a search.
      // When one instant is asked about.
      // Then it answers. A search for the next opening would run on forever
      // here, and asking about a single instant has nowhere to look.
      assertFalse(activeAt({ type: "never" }, when("2026-03-09T10:00")));
    });
  });

  describe("elapsed", () => {
    it("adds up the time a rule covers", () => {
      // Given a week of opening hours.
      // When it is measured.
      // Then five days of eight hours come to forty.
      assertIdentical(elapsed(open(), WEEK).toString(), "PT40H");
    });

    it("counts nothing for a rule that covers nothing", () => {
      // Given a rule covering no time and a bounded week.
      // When it is measured.
      // Then the total is zero, which is an answer.
      assertIdentical(elapsed({ type: "never" }, WEEK).toString(), "PT0S");
    });

    it("measures real elapsed time across a clock change", () => {
      // Given the whole of the day London loses an hour.
      const springForward = inWindow("2026-03-29T00:00", "2026-03-30T00:00");

      // When all of it is measured.
      // Then the day is 23 hours long. This is elapsed time and the calendar
      // day is shorter than the clock suggests.
      assertIdentical(
        elapsed({ type: "always" }, springForward).toString(),
        "PT23H",
      );
    });

    it("refuses a window with no end", () => {
      // Given a context that never stops.
      // When the covered time is measured.
      // Then it is refused. The alternative is a number that never finishes
      // being counted.
      const error = assertThrowsError(() =>
        elapsed(open(), inWindow("2026-03-09T00:00")),
      );

      assertInstanceOf(error, RangeError);
    });
  });

  describe("next", () => {
    it("finds the next opening", () => {
      // Given six in the morning, before the day starts.
      // When the next opening is asked for.
      const found = next(open(), inWindow("2026-03-09T06:00"));

      // Then it is nine that same morning.
      assertIdentical(
        found?.start?.toPlainDateTime().toString(),
        "2026-03-09T09:00:00",
      );
    });

    it("says it is open now, rather than skipping to tomorrow", () => {
      // Given a moment inside opening hours.
      // When the next opening is asked for.
      const found = next(open(), inWindow("2026-03-09T10:00"));

      // Then the answer begins where the asking did.
      assertIdentical(
        found?.start?.toPlainDateTime().toString(),
        "2026-03-09T10:00:00",
      );
    });

    it("crosses the weekend", () => {
      // Given a Saturday morning.
      // When the next opening is asked for.
      const found = next(open(), inWindow("2026-03-14T10:00"));

      // Then it is Monday, two days of nothing later.
      assertIdentical(
        found?.start?.toPlainDateTime().toString(),
        "2026-03-16T09:00:00",
      );
    });

    it("finds nothing within a search that is too short", () => {
      // Given a Saturday morning and twelve hours to look in.
      // When the next opening is asked for.
      const found = next(open(), inWindow("2026-03-14T10:00"), {
        within: Temporal.Duration.from({ hours: 12 }),
      });

      // Then there is none. Monday is past the horizon.
      assertUndefined(found);
    });

    it("lets `within` narrow a window but never widen it", () => {
      // Given a context covering Saturday morning only. The caller who wrote
      // that window meant it.
      const saturdayMorning = inWindow("2026-03-14T10:00", "2026-03-14T12:00");

      // When a week of horizon is offered on top of it.
      const found = next(open(), saturdayMorning, {
        within: Temporal.Duration.from({ days: 7 }),
      });

      // Then the answer is still nothing. A generous `within` cannot talk a
      // caller into Monday.
      assertUndefined(found);
    });

    it("finds it once the search is long enough", () => {
      // Given the same Saturday morning and three days to look in.
      // When the next opening is asked for.
      const found = next(open(), inWindow("2026-03-14T10:00"), {
        within: Temporal.Duration.from({ days: 3 }),
      });

      // Then Monday is inside the horizon and comes back.
      assertIdentical(
        found?.start?.toPlainDateTime().toString(),
        "2026-03-16T09:00:00",
      );
    });
  });

  describe("advanceBy", () => {
    it("counts only the hours the rule covers", () => {
      // Given four in the afternoon on a Monday, with an hour left before
      // closing, and two hours of work to do.
      // When the work is advanced through.
      const reached = advanceBy(when("2026-03-09T16:00"), hours(2), {
        during: open(),
      });

      // Then one hour goes on the Monday and the other on Tuesday morning.
      assertIdentical(
        reached?.toPlainDateTime().toString(),
        "2026-03-10T10:00:00",
      );
    });

    it("carries a whole day's worth over into the next", () => {
      // Given twelve hours of work starting at nine, in eight-hour days.
      // When it is advanced through.
      const reached = advanceBy(when("2026-03-09T09:00"), hours(12), {
        during: open(),
      });

      // Then eight hours fill the Monday and four reach into Tuesday.
      assertIdentical(
        reached?.toPlainDateTime().toString(),
        "2026-03-10T13:00:00",
      );
    });

    it("crosses a weekend, which is the case people get wrong by hand", () => {
      // Given three operating hours from five to five on a Friday.
      // When they are advanced through.
      const reached = advanceBy(when("2026-03-13T16:55"), hours(3), {
        during: open(),
      });

      // Then five minutes go on the Friday and the rest on Monday morning.
      assertIdentical(
        reached?.toPlainDateTime().toString(),
        "2026-03-16T11:55:00",
      );
    });

    it("skips a holiday as well as the weekend", () => {
      // Given opening hours with the Tuesday taken out, and two hours of work
      // starting an hour before the Monday closes.
      const openExceptTuesday = weekdays()
        .and(timeOfDay("09:00", "17:00"))
        .except(dates("2026-03-10"));

      // When the work is advanced through.
      const reached = advanceBy(when("2026-03-09T16:00"), hours(2), {
        during: openExceptTuesday,
      });

      // Then the second hour lands on the Wednesday.
      assertIdentical(
        reached?.toPlainDateTime().toString(),
        "2026-03-11T10:00:00",
      );
    });

    it("stays put when nothing is asked for and the clock is already running", () => {
      // Given no work at all, asked from inside opening hours.
      // When it is advanced through.
      // Then the answer is where it started.
      const reached = advanceBy(when("2026-03-09T10:00"), hours(0), {
        during: open(),
      });

      assertIdentical(
        reached?.toPlainDateTime().toString(),
        "2026-03-09T10:00:00",
      );
    });

    it("moves to the next opening when nothing is asked for and it is shut", () => {
      // Given no work at all, asked on a Saturday.
      // When it is advanced through.
      // Then the answer is the next moment that counts at all.
      const reached = advanceBy(when("2026-03-14T10:00"), hours(0), {
        during: open(),
      });

      assertIdentical(
        reached?.toPlainDateTime().toString(),
        "2026-03-16T09:00:00",
      );
    });

    it("gives up when the search runs out before the time does", () => {
      // Given a hundred hours of work and three days to fit it into.
      // When it is advanced through.
      // Then there is no answer to give.
      const reached = advanceBy(when("2026-03-09T09:00"), hours(100), {
        during: open(),
        within: Temporal.Duration.from({ days: 3 }),
      });

      assertUndefined(reached);
    });

    it("refuses calendar units, which do not mean one fixed length of time", () => {
      // Given amounts written in units the calendar decides the length of.
      // `P1D` would be compared as 24 hours and then added as a calendar day,
      // and those land an hour apart on the morning a clock changes.
      const ambiguous = [
        Temporal.Duration.from({ days: 1 }),
        Temporal.Duration.from({ weeks: 1 }),
        Temporal.Duration.from({ months: 1 }),
        Temporal.Duration.from({ years: 1 }),
      ];

      for (const amount of ambiguous) {
        // When each is advanced through.
        const error = assertThrowsError(() =>
          advanceBy(when("2026-03-29T00:00"), amount, {
            during: { type: "always" },
          }),
        );

        // Then each is refused, and the message says why.
        assertInstanceOf(error, RangeError);
        assertStringIncludes(error.message, "calendar units");
      }
    });

    it("takes the exact equivalent happily", () => {
      // Given the same 24 hours written as hours, over a rule covering all time,
      // from midnight on the day London loses an hour.
      // When it is advanced through.
      // Then it lands at one in the morning. The day held 23 hours, so the last
      // hour of work runs into the next.
      const reached = advanceBy(when("2026-03-29T00:00"), hours(24), {
        during: { type: "always" },
      });

      assertIdentical(
        reached?.toPlainDateTime().toString(),
        "2026-03-30T01:00:00",
      );
    });

    it("refuses to go backwards", () => {
      // Given a negative amount of work.
      // When it is advanced through.
      // Then it is refused.
      const error = assertThrowsError(() =>
        advanceBy(when("2026-03-09T10:00"), hours(-1), { during: open() }),
      );

      assertInstanceOf(error, RangeError);
    });
  });
});
