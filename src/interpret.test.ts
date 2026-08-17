import { inWindow, render } from "#test/intervals.js";
import {
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { intervals } from "./interpret.js";
import type { Rule } from "./rule.js";
import { take } from "./stream.js";

describe("reading a rule as intervals", () => {
  /** Monday 2026-03-09 to Monday 2026-03-16, a whole week. */
  const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

  const read = (rule: Rule, context = WEEK): string =>
    render(intervals(rule, context));

  describe("always and never", () => {
    it("covers the whole window", () => {
      // Given the rule that covers all of time, over a week.
      // When it is read.
      // Then the answer is the window. Clipping is what bounds it.
      assertIdentical(
        read({ type: "always" }),
        "[2026-03-09T00:00:00,2026-03-16T00:00:00)",
      );
    });

    it("covers nothing", () => {
      // Given the rule that covers no time.
      // When it is read.
      // Then the stream is empty, which is an answer and not a hang.
      assertIdentical(read({ type: "never" }), "");
    });

    it("runs to the unbounded future when the window has no end", () => {
      // Given a context that never stops.
      // When all of time is read over it.
      // Then one interval comes back, open at the end.
      assertIdentical(
        read({ type: "always" }, inWindow("2026-03-09T00:00")),
        "[2026-03-09T00:00:00,*)",
      );
    });
  });

  describe("days of the week", () => {
    it("selects single days", () => {
      // Given one weekday named.
      // When the week is read.
      // Then that day comes back, midnight to midnight.
      assertIdentical(
        read({ type: "daysOfWeek", days: ["wednesday"] }),
        "[2026-03-11T00:00:00,2026-03-12T00:00:00)",
      );
    });

    it("merges a run of consecutive days into one interval", () => {
      // Given the two days of a weekend.
      // When the week is read.
      // Then one interval covers both. The contract is coalesced output, and
      // two days touching at midnight are one stretch of time.
      assertIdentical(
        read({ type: "daysOfWeek", days: ["saturday", "sunday"] }),
        "[2026-03-14T00:00:00,2026-03-16T00:00:00)",
      );
    });

    it("keeps non-consecutive days apart", () => {
      // Given two days with one between them.
      // When the week is read.
      // Then they arrive as two intervals.
      assertIdentical(
        read({ type: "daysOfWeek", days: ["monday", "wednesday"] }),
        "[2026-03-09T00:00:00,2026-03-10T00:00:00) " +
          "[2026-03-11T00:00:00,2026-03-12T00:00:00)",
      );
    });

    it("terminates when every day matches, because the window ends", () => {
      // Given all seven days, so the run of matches never breaks.
      // When the week is read.
      // Then one interval covers the window. The run closes only because the
      // window ends, and without that flush nothing would ever be yielded.
      assertIdentical(
        read({
          type: "daysOfWeek",
          days: [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ],
        }),
        "[2026-03-09T00:00:00,2026-03-16T00:00:00)",
      );
    });

    it("covers nothing when no days are selected, without walking the calendar", () => {
      // Given no days at all and a context with no end. A predicate that never
      // matches would otherwise walk forward to Temporal's year limit and fail
      // there, reporting a date-range error instead of an empty rule.
      const endless = intervals(
        { type: "daysOfWeek", days: [] },
        inWindow("2026-03-09T00:00"),
      );

      // When one interval is asked for.
      // Then nothing comes back, at once.
      assertIdentical(render(take(endless, 1)), "");
    });

    it("is endless without a window, and still cheap to sample", () => {
      // Given one weekday over a context with no end.
      const endless = intervals(
        { type: "daysOfWeek", days: ["wednesday"] },
        inWindow("2026-03-09T00:00"),
      );

      // When two are taken.
      // Then this week's and next week's arrive.
      assertIdentical(
        render(take(endless, 2)),
        "[2026-03-11T00:00:00,2026-03-12T00:00:00) " +
          "[2026-03-18T00:00:00,2026-03-19T00:00:00)",
      );
    });
  });

  describe("times of day", () => {
    const twoDays = inWindow("2026-03-09T00:00", "2026-03-11T00:00");

    it("repeats a window each day", () => {
      // Given office hours over two days.
      // When they are read.
      // Then one window arrives per day.
      assertIdentical(
        read({ type: "timeOfDay", from: "09:00", to: "17:00" }, twoDays),
        "[2026-03-09T09:00:00,2026-03-09T17:00:00) " +
          "[2026-03-10T09:00:00,2026-03-10T17:00:00)",
      );
    });

    it("wraps past midnight for a night shift", () => {
      // Given ten at night until six in the morning, over two days.
      // When it is read.
      // Then three intervals arrive: the shift that began before the window
      // opened, the whole shift between the days, and the one cut off by the
      // window's end.
      assertIdentical(
        read({ type: "timeOfDay", from: "22:00", to: "06:00" }, twoDays),
        "[2026-03-09T00:00:00,2026-03-09T06:00:00) " +
          "[2026-03-09T22:00:00,2026-03-10T06:00:00) " +
          "[2026-03-10T22:00:00,2026-03-11T00:00:00)",
      );
    });

    it("refuses a window whose start and end coincide", () => {
      // Given a window from nine to nine, which could mean a whole day or none.
      // When it is read.
      // Then it is refused. A rule that has to be guessed at is worse than one
      // that complains, and `always` says the whole day unambiguously.
      const error = assertThrowsError(() =>
        read({ type: "timeOfDay", from: "09:00", to: "09:00" }),
      );

      assertInstanceOf(error, RangeError);
    });

    it("keeps wall-clock hours across a spring-forward transition", () => {
      // Given office hours over the weekend London loses an hour, at 01:00 on
      // the 29th and well outside the working day.
      const dstWeekend = inWindow("2026-03-28T00:00", "2026-03-30T00:00");

      // When they are read.
      // Then both days still run nine to five. The clock times stay put and the
      // elapsed length of the day is what moves.
      assertIdentical(
        read({ type: "timeOfDay", from: "09:00", to: "17:00" }, dstWeekend),
        "[2026-03-28T09:00:00,2026-03-28T17:00:00) " +
          "[2026-03-29T09:00:00,2026-03-29T17:00:00)",
      );
    });
  });

  describe("dates", () => {
    it("selects the days named", () => {
      // Given one date.
      // When the week is read.
      // Then that whole day comes back.
      assertIdentical(
        read({ type: "dates", dates: ["2026-03-12"] }),
        "[2026-03-12T00:00:00,2026-03-13T00:00:00)",
      );
    });

    it("sorts, de-duplicates and merges consecutive dates", () => {
      // Given two consecutive dates out of order, one of them written twice, as
      // a hand-written holiday list would be.
      // When the week is read.
      // Then one interval covers both days.
      assertIdentical(
        read({
          type: "dates",
          dates: ["2026-03-11", "2026-03-10", "2026-03-11"],
        }),
        "[2026-03-10T00:00:00,2026-03-12T00:00:00)",
      );
    });

    it("covers nothing when given no dates", () => {
      // Given an empty date list, as a holiday calendar with nothing in it.
      // When the week is read.
      // Then nothing comes back.
      assertIdentical(read({ type: "dates", dates: [] }), "");
    });

    it("ends with the dates, without walking the calendar between them", () => {
      // Given two dates most of a year apart, over a window holding both.
      const wide = inWindow("2026-01-01T00:00", "2027-01-01T00:00");

      // When they are read.
      // Then both arrive in order. The generator walks the dates given to it
      // and not the days between, so a handful of dates costs a handful of
      // steps however far apart they fall.
      assertIdentical(
        read({ type: "dates", dates: ["2026-12-25", "2026-01-01"] }, wide),
        "[2026-01-01T00:00:00,2026-01-02T00:00:00) " +
          "[2026-12-25T00:00:00,2026-12-26T00:00:00)",
      );
    });
  });

  describe("combining rules", () => {
    const officeHours: Rule = {
      type: "all",
      rules: [
        {
          type: "daysOfWeek",
          days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        },
        { type: "timeOfDay", from: "09:00", to: "17:00" },
      ],
    };

    it("intersects", () => {
      // Given office hours over a Friday and a Saturday.
      const twoDays = inWindow("2026-03-13T00:00", "2026-03-15T00:00");

      // When they are read.
      // Then only the Friday appears. Both halves have to hold.
      assertIdentical(
        read(officeHours, twoDays),
        "[2026-03-13T09:00:00,2026-03-13T17:00:00)",
      );
    });

    it("takes no rules in `all` as no limits", () => {
      // Given an intersection of nothing, as a filtered list would give.
      // When the week is read.
      // Then the whole window comes back. This is the identity, and it makes
      // building from a list that emptied behave.
      assertIdentical(
        read({ type: "all", rules: [] }),
        "[2026-03-09T00:00:00,2026-03-16T00:00:00)",
      );
    });

    it("unions", () => {
      // Given a Saturday and one midweek date.
      // When the week is read.
      // Then both arrive, in order, apart from each other.
      assertIdentical(
        read({
          type: "any",
          rules: [
            { type: "daysOfWeek", days: ["saturday"] },
            { type: "dates", dates: ["2026-03-11"] },
          ],
        }),
        "[2026-03-11T00:00:00,2026-03-12T00:00:00) " +
          "[2026-03-14T00:00:00,2026-03-15T00:00:00)",
      );
    });

    it("takes no rules in `any` as no times", () => {
      // Given a union of nothing.
      // When the week is read.
      // Then nothing comes back, the other identity.
      assertIdentical(read({ type: "any", rules: [] }), "");
    });

    it("complements within the window rather than beyond it", () => {
      // Given the complement of a weekend.
      // When the week is read.
      // Then the five weekdays come back as one stretch, cut to the window. A
      // complement is unbounded at both ends by nature, and the re-clip is what
      // keeps it inside what was asked about.
      assertIdentical(
        read({
          type: "not",
          rule: { type: "daysOfWeek", days: ["saturday", "sunday"] },
        }),
        "[2026-03-09T00:00:00,2026-03-14T00:00:00)",
      );
    });

    it("excludes a holiday from a working week", () => {
      // Given office hours intersected with the complement of one date, which
      // is the shape every real schedule has.
      const excused: Rule = {
        type: "all",
        rules: [
          officeHours,
          { type: "not", rule: { type: "dates", dates: ["2026-03-11"] } },
        ],
      };

      // When the week is read.
      // Then four working days remain and the Wednesday is gone.
      assertIdentical(
        read(excused),
        "[2026-03-09T09:00:00,2026-03-09T17:00:00) " +
          "[2026-03-10T09:00:00,2026-03-10T17:00:00) " +
          "[2026-03-12T09:00:00,2026-03-12T17:00:00) " +
          "[2026-03-13T09:00:00,2026-03-13T17:00:00)",
      );
    });
  });

  describe("zones", () => {
    const tokyoDay = inWindow(
      "2026-03-09T00:00",
      "2026-03-10T00:00",
      "Asia/Tokyo",
    );

    it("reads a rule in the context's zone by default", () => {
      // Given office hours with no zone of their own, asked about from Tokyo.
      // When they are read.
      // Then nine o'clock means nine in Tokyo. A rule with no zone means
      // "wherever this is being asked about".
      assertIdentical(
        read({ type: "timeOfDay", from: "09:00", to: "17:00" }, tokyoDay),
        "[2026-03-09T09:00:00,2026-03-09T17:00:00)",
      );
    });

    it("lets a rule name its own zone, so one rule set can span offices", () => {
      // Given London office hours, asked about from two Tokyo days. London is
      // nine hours behind in March, so 09:00-17:00 there is 18:00-02:00 here.
      const tokyoDays = inWindow(
        "2026-03-09T00:00",
        "2026-03-11T00:00",
        "Asia/Tokyo",
      );

      // When they are read.
      // Then the answers land in the evening and run past midnight, and they
      // come back in Tokyo time because that is where the question was asked.
      assertIdentical(
        read(
          {
            type: "timeOfDay",
            from: "09:00",
            to: "17:00",
            zone: "Europe/London",
          },
          tokyoDays,
        ),
        "[2026-03-09T00:00:00,2026-03-09T02:00:00) " +
          "[2026-03-09T18:00:00,2026-03-10T02:00:00) " +
          "[2026-03-10T18:00:00,2026-03-11T00:00:00)",
      );
    });

    it("reads every interval back in one zone, never a mix of two", () => {
      // Given a London rule read from a Tokyo context. A sweep may take one
      // interval's start and another's end, and those can have been written in
      // different zones.
      const london: Rule = {
        type: "timeOfDay",
        from: "09:00",
        to: "17:00",
        zone: "Europe/London",
      };

      // When the intervals are read.
      // Then both halves of each one agree about what time it is.
      for (const interval of intervals(london, tokyoDay)) {
        assertIdentical(interval.start?.timeZoneId, "Asia/Tokyo");
        assertIdentical(interval.end?.timeZoneId, "Asia/Tokyo");
      }
    });
  });
});
