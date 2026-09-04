import { inWindow, render, when } from "#test/intervals.js";
import {
  assertArrayLength,
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { intervals } from "./interpret.js";
import { parseRule } from "./parse.js";
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

  describe("days of the month", () => {
    /** A whole non-leap year, so month lengths vary across the window. */
    const YEAR = inWindow("2026-01-01T00:00", "2027-01-01T00:00");

    it("selects the same date in every month", () => {
      // Given the first of the month, over a quarter.
      const quarter = inWindow("2026-01-01T00:00", "2026-04-01T00:00");

      // When it is read.
      // Then January, February and March each contribute their first day.
      assertIdentical(
        read({ type: "daysOfMonth", days: [1] }, quarter),
        "[2026-01-01T00:00:00,2026-01-02T00:00:00) " +
          "[2026-02-01T00:00:00,2026-02-02T00:00:00) " +
          "[2026-03-01T00:00:00,2026-03-02T00:00:00)",
      );
    });

    it("skips a month too short to reach the day", () => {
      // Given the 30th, over January to March 2026. February has 28 days.
      const quarter = inWindow("2026-01-01T00:00", "2026-04-01T00:00");

      // When it is read.
      // Then February contributes nothing rather than falling back to its last
      // day, which is what a schedule that says "the 30th" means.
      assertIdentical(
        read({ type: "daysOfMonth", days: [30] }, quarter),
        "[2026-01-30T00:00:00,2026-01-31T00:00:00) " +
          "[2026-03-30T00:00:00,2026-03-31T00:00:00)",
      );
    });

    it("resolves a negative day against the month it lands in", () => {
      // Given the last day of the month, over a quarter whose months are 31,
      // 28 and 31 days long.
      const quarter = inWindow("2026-01-01T00:00", "2026-04-01T00:00");

      // When it is read.
      // Then each month gives up its own last day, not a fixed date.
      assertIdentical(
        read({ type: "daysOfMonth", days: [-1] }, quarter),
        "[2026-01-31T00:00:00,2026-02-01T00:00:00) " +
          "[2026-02-28T00:00:00,2026-03-01T00:00:00) " +
          "[2026-03-31T00:00:00,2026-04-01T00:00:00)",
      );
    });

    it("finds the extra day a leap year adds", () => {
      // Given the last day of February in 2028, which is a leap year.
      const february = inWindow("2028-02-01T00:00", "2028-03-01T00:00");

      // When the last day of the month is read.
      // Then it is the 29th, which no fixed date would have found.
      assertIdentical(
        read({ type: "daysOfMonth", days: [-1] }, february),
        "[2028-02-29T00:00:00,2028-03-01T00:00:00)",
      );
    });

    it("covers nothing on a date the zone skipped", () => {
      // Given Samoa's move across the date line, which took the country from
      // 29 December 2011 to 31 December. There was no 30th.
      const apia = inWindow(
        "2011-12-01T00:00",
        "2012-01-05T00:00",
        "Pacific/Apia",
      );

      // When the 30th of the month is read over it.
      // Then December contributes nothing. A skipped date has no elapsed time,
      // so the day and the day after it start at the same instant and the
      // empty interval between them is dropped.
      assertIdentical(read({ type: "daysOfMonth", days: [30] }, apia), "");
    });

    it("merges days that land next to each other", () => {
      // Given the 1st and the last day of the month, over two months. The last
      // day of January and the first of February are consecutive.
      const twoMonths = inWindow("2026-01-01T00:00", "2026-03-01T00:00");

      // When they are read.
      // Then the pair spanning the month boundary is one interval, because the
      // stream contract has no two intervals meeting at midnight.
      assertIdentical(
        read({ type: "daysOfMonth", days: [1, -1] }, twoMonths),
        "[2026-01-01T00:00:00,2026-01-02T00:00:00) " +
          "[2026-01-31T00:00:00,2026-02-02T00:00:00) " +
          "[2026-02-28T00:00:00,2026-03-01T00:00:00)",
      );
    });

    it("counts payday twice a month", () => {
      // Given the 15th and the last day, which is how salaries are often run.
      const halfYear = inWindow("2026-01-01T00:00", "2026-07-01T00:00");

      // When the paydays are counted over six months.
      // Then there are twelve of them.
      const paydays = [
        ...intervals({ type: "daysOfMonth", days: [15, -1] }, halfYear),
      ];
      assertArrayLength(paydays, 12);
    });

    it("covers nothing when no days are selected, without walking the calendar", () => {
      // Given no days at all and a context with no end. The same trap as an
      // empty weekday list: a predicate nothing satisfies would walk forward to
      // Temporal's year limit before admitting it.
      const endless = intervals(
        { type: "daysOfMonth", days: [] },
        inWindow("2026-03-09T00:00"),
      );

      // When one interval is asked for.
      // Then nothing comes back, at once.
      assertIdentical(render(take(endless, 1)), "");
    });

    it("is endless without a window", () => {
      // Given the 1st of the month over a context with no end.
      const endless = intervals(
        { type: "daysOfMonth", days: [1] },
        inWindow("2026-03-09T00:00"),
      );

      // When two are taken.
      // Then April and May arrive; March is already past on the 9th.
      assertIdentical(
        render(take(endless, 2)),
        "[2026-04-01T00:00:00,2026-04-02T00:00:00) " +
          "[2026-05-01T00:00:00,2026-05-02T00:00:00)",
      );
    });

    it("reads a day in its own zone", () => {
      // Given the 1st of the month in Tokyo, read from a London context. Tokyo
      // is nine hours ahead, so its day starts while London is still on the
      // previous evening.
      const april = inWindow("2026-04-01T00:00", "2026-04-03T00:00");

      // When it is read.
      // Then the interval is Tokyo's day, reported in London's clock.
      assertIdentical(
        read({ type: "daysOfMonth", days: [1], zone: "Asia/Tokyo" }, april),
        "[2026-04-01T00:00:00,2026-04-01T16:00:00)",
      );
    });

    it("takes a whole year of month ends without missing one", () => {
      // Given the last day of every month across 2026.
      // When they are read.
      // Then there are twelve, one per month.
      const ends = [...intervals({ type: "daysOfMonth", days: [-1] }, YEAR)];
      assertArrayLength(ends, 12);
    });
  });

  describe("the nth day of the week in a month", () => {
    it("finds the first of a weekday in each month", () => {
      // Given the first Monday, over a quarter. This is the shape of every
      // recurring monthly meeting there is.
      const quarter = inWindow("2026-01-01T00:00", "2026-04-01T00:00");

      // When it is read.
      // Then one Monday comes back per month.
      assertIdentical(
        read(
          { type: "nthDayOfWeekInMonth", nth: 1, days: ["monday"] },
          quarter,
        ),
        "[2026-01-05T00:00:00,2026-01-06T00:00:00) " +
          "[2026-02-02T00:00:00,2026-02-03T00:00:00) " +
          "[2026-03-02T00:00:00,2026-03-03T00:00:00)",
      );
    });

    it("counts back from the end for a negative occurrence", () => {
      // Given the last Friday of the month, over a quarter. January 2026 has
      // five Fridays and February has four, so a fixed count would miss one.
      const quarter = inWindow("2026-01-01T00:00", "2026-04-01T00:00");

      // When it is read.
      // Then each month gives up its own final Friday.
      assertIdentical(
        read(
          { type: "nthDayOfWeekInMonth", nth: -1, days: ["friday"] },
          quarter,
        ),
        "[2026-01-30T00:00:00,2026-01-31T00:00:00) " +
          "[2026-02-27T00:00:00,2026-02-28T00:00:00) " +
          "[2026-03-27T00:00:00,2026-03-28T00:00:00)",
      );
    });

    it("covers nothing in a month without a fifth of that weekday", () => {
      // Given the fifth Monday, over a quarter. Only some months have one.
      const quarter = inWindow("2026-01-01T00:00", "2026-04-01T00:00");

      // When it is read.
      // Then the months without a fifth Monday contribute nothing rather than
      // falling back to the fourth.
      assertIdentical(
        read(
          { type: "nthDayOfWeekInMonth", nth: 5, days: ["monday"] },
          quarter,
        ),
        "[2026-03-30T00:00:00,2026-03-31T00:00:00)",
      );
    });

    it("takes more than one weekday at the same position", () => {
      // Given the first Saturday and the first Sunday, which is how a monthly
      // weekend event is written.
      const january = inWindow("2026-01-01T00:00", "2026-02-01T00:00");

      // When January is read. Its first Saturday is the 3rd and its first
      // Sunday is the 4th, so the two are consecutive.
      // Then they come back as one interval, the way any two touching days do.
      assertIdentical(
        read(
          { type: "nthDayOfWeekInMonth", nth: 1, days: ["saturday", "sunday"] },
          january,
        ),
        "[2026-01-03T00:00:00,2026-01-05T00:00:00)",
      );
    });

    it("covers nothing when no weekdays are selected", () => {
      // Given no days at all and a context with no end.
      const endless = intervals(
        { type: "nthDayOfWeekInMonth", nth: 1, days: [] },
        inWindow("2026-03-09T00:00"),
      );

      // When one interval is asked for.
      // Then nothing comes back, at once.
      assertIdentical(render(take(endless, 1)), "");
    });

    it("is endless without a window", () => {
      // Given the second Tuesday over a context with no end. This is patch
      // Tuesday, which is the rule most people meet it as.
      const endless = intervals(
        { type: "nthDayOfWeekInMonth", nth: 2, days: ["tuesday"] },
        inWindow("2026-03-09T00:00"),
      );

      // When two are taken.
      // Then March's and April's arrive.
      assertIdentical(
        render(take(endless, 2)),
        "[2026-03-10T00:00:00,2026-03-11T00:00:00) " +
          "[2026-04-14T00:00:00,2026-04-15T00:00:00)",
      );
    });

    it("reads a day in its own zone", () => {
      // Given the first Monday in Tokyo, read from a London context.
      const january = inWindow("2026-01-05T00:00", "2026-01-07T00:00");

      // When it is read.
      // Then the interval is Tokyo's day, reported on London's clock.
      assertIdentical(
        read(
          {
            type: "nthDayOfWeekInMonth",
            nth: 1,
            days: ["monday"],
            zone: "Asia/Tokyo",
          },
          january,
        ),
        "[2026-01-05T00:00:00,2026-01-05T15:00:00)",
      );
    });
  });

  describe("months of the year", () => {
    it("covers a named month whole", () => {
      // Given August, over the second half of 2026.
      const halfYear = inWindow("2026-07-01T00:00", "2027-01-01T00:00");

      // When it is read.
      // Then the interval is the whole month, midnight to midnight.
      assertIdentical(
        read({ type: "monthsOfYear", months: ["august"] }, halfYear),
        "[2026-08-01T00:00:00,2026-09-01T00:00:00)",
      );
    });

    it("merges consecutive months into one interval", () => {
      // Given the three summer months.
      const year = inWindow("2026-01-01T00:00", "2027-01-01T00:00");

      // When they are read.
      // Then they are one interval and not three touching at midnight.
      assertIdentical(
        read(
          { type: "monthsOfYear", months: ["june", "july", "august"] },
          year,
        ),
        "[2026-06-01T00:00:00,2026-09-01T00:00:00)",
      );
    });

    it("keeps months apart when they do not adjoin", () => {
      // Given the quarter ends, which are three months apart.
      const halfYear = inWindow("2026-01-01T00:00", "2026-07-01T00:00");

      // When they are read.
      // Then March and June come back separately.
      assertIdentical(
        read({ type: "monthsOfYear", months: ["march", "june"] }, halfYear),
        "[2026-03-01T00:00:00,2026-04-01T00:00:00) " +
          "[2026-06-01T00:00:00,2026-07-01T00:00:00)",
      );
    });

    it("wraps from December into January as one interval", () => {
      // Given December and January, over a window spanning the new year.
      const winter = inWindow("2026-11-01T00:00", "2027-03-01T00:00");

      // When they are read.
      // Then the pair either side of the year boundary is one interval.
      assertIdentical(
        read({ type: "monthsOfYear", months: ["december", "january"] }, winter),
        "[2026-12-01T00:00:00,2027-02-01T00:00:00)",
      );
    });

    it("covers nothing when no months are selected, without walking the calendar", () => {
      // Given no months at all and a context with no end.
      const endless = intervals(
        { type: "monthsOfYear", months: [] },
        inWindow("2026-03-09T00:00"),
      );

      // When one interval is asked for.
      // Then nothing comes back, at once.
      assertIdentical(render(take(endless, 1)), "");
    });

    it("is endless without a window", () => {
      // Given February over a context with no end.
      const endless = intervals(
        { type: "monthsOfYear", months: ["february"] },
        inWindow("2026-03-09T00:00"),
      );

      // When two are taken.
      // Then 2027's and 2028's arrive, the second one a day longer.
      assertIdentical(
        render(take(endless, 2)),
        "[2027-02-01T00:00:00,2027-03-01T00:00:00) " +
          "[2028-02-01T00:00:00,2028-03-01T00:00:00)",
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

  describe("every nth period", () => {
    it("covers the whole of each selected period", () => {
      // Given every other week, anchored on Monday 2026-03-09.
      const threeWeeks = inWindow("2026-03-09T00:00", "2026-03-30T00:00");

      // When three weeks are read.
      // Then seven days out of every fourteen come back, whole. Narrowing to a
      // day within them is what intersecting with another rule is for.
      assertIdentical(
        read(
          {
            type: "every",
            interval: 2,
            period: "weeks",
            anchor: "2026-03-09",
          },
          threeWeeks,
        ),
        "[2026-03-09T00:00:00,2026-03-16T00:00:00) " +
          "[2026-03-23T00:00:00,2026-03-30T00:00:00)",
      );
    });

    it("gives every other Monday when narrowed to a weekday", () => {
      // Given the fortnightly cycle intersected with Mondays, which is the
      // shape a real fortnightly meeting has.
      const month = inWindow("2026-03-09T00:00", "2026-04-13T00:00");
      const fortnightly = {
        type: "all",
        rules: [
          { type: "every", interval: 2, period: "weeks", anchor: "2026-03-09" },
          { type: "daysOfWeek", days: ["monday"] },
        ],
      } as const;

      // When five weeks are read.
      // Then the Mondays come every fortnight.
      assertIdentical(
        read(fortnightly, month),
        "[2026-03-09T00:00:00,2026-03-10T00:00:00) " +
          "[2026-03-23T00:00:00,2026-03-24T00:00:00) " +
          "[2026-04-06T00:00:00,2026-04-07T00:00:00)",
      );
    });

    it("counts backwards from the anchor as well as forwards", () => {
      // Given a cycle anchored in April, read over the March before it. The
      // anchor sets the phase and is not a bound, so the earlier weeks of the
      // same cycle are covered too.
      const before = inWindow("2026-03-16T00:00", "2026-03-30T00:00");

      // When March is read.
      // Then the week two before the anchor comes back, on the same phase.
      assertIdentical(
        read(
          {
            type: "every",
            interval: 2,
            period: "weeks",
            anchor: "2026-04-06",
          },
          before,
        ),
        "[2026-03-23T00:00:00,2026-03-30T00:00:00)",
      );
    });

    it("steps through months on the calendar", () => {
      // Given a quarterly cycle anchored in January.
      const halfYear = inWindow("2026-01-01T00:00", "2026-07-01T00:00");

      // When six months are read.
      // Then January and April come back whole, and the months between do not.
      // A month is however long the calendar makes it.
      assertIdentical(
        read(
          {
            type: "every",
            interval: 3,
            period: "months",
            anchor: "2026-01-15",
          },
          halfYear,
        ),
        "[2026-01-01T00:00:00,2026-02-01T00:00:00) " +
          "[2026-04-01T00:00:00,2026-05-01T00:00:00)",
      );
    });

    it("steps through years", () => {
      // Given a leap-year cycle anchored on 2024.
      const threeYears = inWindow("2027-01-01T00:00", "2029-01-01T00:00");

      // When two years are read.
      // Then 2028 comes back and 2027 does not.
      assertIdentical(
        read(
          {
            type: "every",
            interval: 4,
            period: "years",
            anchor: "2024-02-29",
          },
          threeYears,
        ),
        "[2028-01-01T00:00:00,2029-01-01T00:00:00)",
      );
    });

    it("steps through days", () => {
      // Given every third day.
      const week = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

      // When a week is read.
      // Then three days come back, two apart.
      assertIdentical(
        read(
          { type: "every", interval: 3, period: "days", anchor: "2026-03-09" },
          week,
        ),
        "[2026-03-09T00:00:00,2026-03-10T00:00:00) " +
          "[2026-03-12T00:00:00,2026-03-13T00:00:00) " +
          "[2026-03-15T00:00:00,2026-03-16T00:00:00)",
      );
    });

    it("covers everything at an interval of one", () => {
      // Given the interval RRULE leaves out, which is one.
      const week = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

      // When a week is read.
      // Then every period matches, so the window comes back whole.
      assertIdentical(
        read(
          { type: "every", interval: 1, period: "weeks", anchor: "2026-03-09" },
          week,
        ),
        "[2026-03-09T00:00:00,2026-03-16T00:00:00)",
      );
    });

    it("keeps the week aligned to the anchor day", () => {
      // Given a cycle anchored on a Wednesday. Weeks run from the anchor
      // rather than from whichever day a locale calls first.
      const twoWeeks = inWindow("2026-03-11T00:00", "2026-03-25T00:00");

      // When it is read.
      // Then the covered week is Wednesday to Wednesday.
      assertIdentical(
        read(
          {
            type: "every",
            interval: 2,
            period: "weeks",
            anchor: "2026-03-11",
          },
          twoWeeks,
        ),
        "[2026-03-11T00:00:00,2026-03-18T00:00:00)",
      );
    });

    it("is endless without a window", () => {
      // Given a fortnightly cycle over a context with no end.
      const endless = intervals(
        { type: "every", interval: 2, period: "weeks", anchor: "2026-03-09" },
        inWindow("2026-03-09T00:00"),
      );

      // When two are taken.
      // Then this cycle and the next arrive, a fortnight apart.
      assertIdentical(
        render(take(endless, 2)),
        "[2026-03-09T00:00:00,2026-03-16T00:00:00) " +
          "[2026-03-23T00:00:00,2026-03-30T00:00:00)",
      );
    });
  });

  describe("a bounded stretch of the calendar", () => {
    it("covers both named days whole", () => {
      // Given a range naming two dates. A date names a whole day here, the
      // way it does in `dates`, so both ends are inside it.
      const april = inWindow("2026-04-01T00:00", "2026-05-01T00:00");

      // When it is read.
      // Then the interval runs from the start of the first to the end of the
      // last, which is the start of the day after.
      assertIdentical(
        read(
          { type: "dateRange", from: "2026-04-10", to: "2026-04-12" },
          april,
        ),
        "[2026-04-10T00:00:00,2026-04-13T00:00:00)",
      );
    });

    it("covers a single day when both ends are the same date", () => {
      // Given a range of one day, as `between(d, d)` gives.
      const april = inWindow("2026-04-01T00:00", "2026-05-01T00:00");

      // When it is read.
      // Then that one day comes back.
      assertIdentical(
        read(
          { type: "dateRange", from: "2026-04-10", to: "2026-04-10" },
          april,
        ),
        "[2026-04-10T00:00:00,2026-04-11T00:00:00)",
      );
    });

    it("runs to the unbounded future with no end", () => {
      // Given a schedule that starts in April and never stops, over a context
      // with no end of its own.
      const endless = intervals(
        { type: "dateRange", from: "2026-04-01" },
        inWindow("2026-03-01T00:00"),
      );

      // When it is read.
      // Then one interval comes back, open at the far end.
      assertIdentical(render(endless), "[2026-04-01T00:00:00,*)");
    });

    it("runs from the unbounded past with no start", () => {
      // Given everything up to the end of a financial year.
      const endless = intervals(
        { type: "dateRange", to: "2026-03-31" },
        { from: when("2026-01-01T00:00") },
      );

      // When it is read.
      // Then it ends at the start of 1 April, so the 31st is inside it. The
      // context bounds the near end, which is what clipping is for.
      assertIdentical(
        render(endless),
        "[2026-01-01T00:00:00,2026-04-01T00:00:00)",
      );
    });

    it("bounds a recurring rule to a stretch of the calendar", () => {
      // Given weekday opening hours that only run for one week, which is what
      // this rule is for.
      const march = inWindow("2026-03-01T00:00", "2026-04-01T00:00");
      const trial = {
        type: "all",
        rules: [
          { type: "daysOfWeek", days: ["monday", "tuesday", "wednesday"] },
          { type: "dateRange", from: "2026-03-09", to: "2026-03-15" },
        ],
      } as const;

      // When March is read.
      // Then only that week's Monday to Wednesday come back.
      assertIdentical(
        read(trial, march),
        "[2026-03-09T00:00:00,2026-03-12T00:00:00)",
      );
    });

    it("will not compile without a bound, and is refused if one arrives", () => {
      // Given a range document with neither end, which the rule type has no
      // shape for. A rule literal writing it does not compile:
      //
      //   const boundless: Rule = { type: "dateRange" };
      //   // Type '{ type: "dateRange"; }' is not assignable to type 'Rule'.
      //
      // So it can only arrive as unchecked JSON, and `parseRule` is where that
      // is caught. Without both, the rule would quietly cover all of time.
      const boundless: unknown = { type: "dateRange" };

      // When it is parsed.
      const error = assertThrowsError(() => parseRule(boundless));

      // Then it is refused rather than read as `always`.
      assertInstanceOf(error, TypeError);
      assertIdentical(
        error.message,
        "rule: a date range needs a from, a to, or both",
      );
    });

    it("reads a range in its own zone", () => {
      // Given a range in Tokyo, read from a London context.
      const april = inWindow("2026-04-01T00:00", "2026-04-03T00:00");

      // When it is read.
      // Then the day starts and ends on Tokyo's clock, reported on London's.
      assertIdentical(
        read(
          {
            type: "dateRange",
            from: "2026-04-01",
            to: "2026-04-01",
            zone: "Asia/Tokyo",
          },
          april,
        ),
        "[2026-04-01T00:00:00,2026-04-01T16:00:00)",
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
