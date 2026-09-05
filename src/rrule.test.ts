import { inWindow, render } from "#test/intervals.js";
import {
  assertArrayLength,
  assertIdentical,
  assertInstanceOf,
  assertStringStartsWith,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { dates } from "./build.js";
import type { Interval } from "./interval.js";
import { intervals } from "./interpret.js";
import type { Rule } from "./rule.js";
import { parseRRule } from "./rrule.js";
import { take } from "./stream.js";

describe("reading a recurrence rule as a rule", () => {
  /** The dates one interval covers. */
  const datesIn = (interval: Interval): string[] => {
    const from = interval.start?.toPlainDate();
    const to = interval.end?.toPlainDate();
    if (from === undefined || to === undefined) {
      return [];
    }
    return Array.from({ length: from.until(to).days }, (_, offset) =>
      from.add({ days: offset }).toString(),
    );
  };

  /**
   * The days a recurrence covers, listed.
   *
   * Written out day by day rather than as interval starts, because whole-day
   * occurrences on consecutive days come back as one interval and the
   * assertion is about which days ran.
   */
  const daysOf = (
    of: Rule,
    context: Parameters<typeof intervals>[1],
  ): string => {
    const covered: string[] = [];
    for (const interval of intervals(of, context)) {
      covered.push(...datesIn(interval));
    }
    return covered.join(" ");
  };

  const days = (
    text: string,
    start: string,
    context: Parameters<typeof intervals>[1],
  ): string => daysOf(parseRRule(text, { start }), context);

  /** A recurrence read as its intervals, for the assertions about clock time. */
  const read = (of: Rule, context: Parameters<typeof intervals>[1]): string =>
    render(intervals(of, context));

  /** The message from a recurrence that should not parse. */
  const complaintAbout = (text: string, start = "2026-03-09"): string => {
    const error = assertThrowsError(() => parseRRule(text, { start }));
    assertInstanceOf(error, TypeError);
    return error.message;
  };

  describe("what DTSTART supplies", () => {
    it("repeats on the day it started when nothing names one", () => {
      // Given a weekly recurrence with no BYDAY, started on a Wednesday. RFC
      // 5545 takes the day from DTSTART.
      const month = inWindow("2026-03-01T00:00", "2026-04-01T00:00");

      // When March is read.
      // Then it lands on the Wednesdays.
      assertIdentical(
        days("FREQ=WEEKLY", "2026-03-11", month),
        "2026-03-11 2026-03-18 2026-03-25",
      );
    });

    it("repeats on the date it started for a monthly recurrence", () => {
      // Given a monthly recurrence with no BYMONTHDAY.
      const quarter = inWindow("2026-03-01T00:00", "2026-06-01T00:00");

      // When a quarter is read.
      // Then it lands on the 11th of each month.
      assertIdentical(
        days("FREQ=MONTHLY", "2026-03-11", quarter),
        "2026-03-11 2026-04-11 2026-05-11",
      );
    });

    it("repeats on the month and date it started for a yearly one", () => {
      // Given a yearly recurrence with nothing narrowing it.
      const years = inWindow("2026-01-01T00:00", "2029-01-01T00:00");

      // When three years are read.
      // Then it lands on the same date each year.
      assertIdentical(
        days("FREQ=YEARLY", "2026-03-11", years),
        "2026-03-11 2027-03-11 2028-03-11",
      );
    });

    it("covers nothing before the recurrence starts", () => {
      // Given a daily recurrence starting mid-month, read over the whole
      // month. DTSTART is the first occurrence, not just a phase.
      const month = inWindow("2026-03-01T00:00", "2026-03-15T00:00");

      // When March is read.
      // Then nothing before the 11th is covered.
      assertIdentical(
        days("FREQ=DAILY", "2026-03-11", month),
        "2026-03-11 2026-03-12 2026-03-13 2026-03-14",
      );
    });

    it("takes the time of day from the start", () => {
      // Given a daily recurrence started at a clock time.
      const twoDays = inWindow("2026-03-11T00:00", "2026-03-13T00:00");

      // When two days are read.
      // Then each occurrence is the minute it starts in, which is the reading
      // `parseCron` takes of a firing time.
      assertIdentical(
        read(parseRRule("FREQ=DAILY", { start: "2026-03-11T09:30" }), twoDays),
        "[2026-03-11T09:30:00,2026-03-11T09:31:00) " +
          "[2026-03-12T09:30:00,2026-03-12T09:31:00)",
      );
    });

    it("covers whole days when the start carries no time", () => {
      // Given a start written as a date, which is what an all-day event has.
      const twoDays = inWindow("2026-03-11T00:00", "2026-03-13T00:00");

      // When two days are read.
      // Then the days come back whole, and consecutive ones join.
      assertIdentical(
        read(parseRRule("FREQ=DAILY", { start: "2026-03-11" }), twoDays),
        "[2026-03-11T00:00:00,2026-03-13T00:00:00)",
      );
    });
  });

  describe("intervals", () => {
    it("steps through weeks", () => {
      // Given a fortnightly recurrence.
      const month = inWindow("2026-03-01T00:00", "2026-04-13T00:00");

      // When six weeks are read.
      // Then it lands every other Wednesday.
      assertIdentical(
        days("FREQ=WEEKLY;INTERVAL=2", "2026-03-11", month),
        "2026-03-11 2026-03-25 2026-04-08",
      );
    });

    it("counts weeks from WKST when several days are named", () => {
      // Given a fortnightly recurrence on Mondays and Fridays, started on a
      // Wednesday. RFC 5545 groups the days into weeks that begin on WKST,
      // which is Monday unless something says otherwise, so the Friday after
      // the start is in the same week as the Monday before it.
      const month = inWindow("2026-03-01T00:00", "2026-04-06T00:00");

      // When five weeks are read.
      // Then the Friday of the starting week runs, the next week is skipped,
      // and the week after contributes both its Monday and its Friday.
      assertIdentical(
        days("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR", "2026-03-11", month),
        "2026-03-13 2026-03-23 2026-03-27",
      );
    });

    it("takes WKST as the day it names", () => {
      // Given a fortnightly recurrence on Sundays and Mondays, which are the
      // two days a week boundary falls between. Grouping them into weeks that
      // start on Monday puts them in different weeks, and starting on Sunday
      // puts them in the same one, so the two settings cannot agree.
      const month = inWindow("2026-03-01T00:00", "2026-04-06T00:00");
      const byMonday = days(
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO",
        "2026-03-11",
        month,
      );
      const bySunday = days(
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO;WKST=SU",
        "2026-03-11",
        month,
      );

      // When five weeks are read under each.
      // Then they select different days, which is the whole reason WKST is in
      // the format.
      assertIdentical(byMonday, "2026-03-15 2026-03-23 2026-03-29");
      assertIdentical(bySunday, "2026-03-22 2026-03-23 2026-04-05");
    });

    it("steps through months", () => {
      // Given a quarterly recurrence.
      const year = inWindow("2026-01-01T00:00", "2027-01-01T00:00");

      // When a year is read.
      // Then it lands four times.
      assertArrayLength(
        days("FREQ=MONTHLY;INTERVAL=3", "2026-01-15", year).split(" "),
        4,
      );
    });
  });

  describe("the BY parts", () => {
    it("selects days of the week", () => {
      // Given the recurrence a Monday, Wednesday and Friday class has.
      const twoWeeks = inWindow("2026-03-09T00:00", "2026-03-21T00:00");

      // When two weeks are read.
      // Then it lands on each named day.
      assertIdentical(
        days("FREQ=WEEKLY;BYDAY=MO,WE,FR", "2026-03-09", twoWeeks),
        "2026-03-09 2026-03-11 2026-03-13 2026-03-16 2026-03-18 2026-03-20",
      );
    });

    it("counts a weekday within the month", () => {
      // Given the first Monday of every month, which is BYDAY with an ordinal.
      const quarter = inWindow("2026-01-01T00:00", "2026-04-01T00:00");

      // When a quarter is read.
      // Then it lands on the first Monday of each.
      assertIdentical(
        days("FREQ=MONTHLY;BYDAY=1MO", "2026-01-01", quarter),
        "2026-01-05 2026-02-02 2026-03-02",
      );
    });

    it("counts back from the end of the month", () => {
      // Given the last Friday of every month.
      const quarter = inWindow("2026-01-01T00:00", "2026-04-01T00:00");

      // When a quarter is read.
      // Then each month gives up its own last Friday.
      assertIdentical(
        days("FREQ=MONTHLY;BYDAY=-1FR", "2026-01-01", quarter),
        "2026-01-30 2026-02-27 2026-03-27",
      );
    });

    it("takes counted and bare days in one BYDAY", () => {
      // Given the first Monday and every Friday. RFC 5545 allows both in one
      // part, and the recurrence is the union.
      const month = inWindow("2026-03-01T00:00", "2026-04-01T00:00");

      // When March is read.
      // Then the first Monday and all four Fridays land.
      assertIdentical(
        days("FREQ=MONTHLY;BYDAY=1MO,FR", "2026-03-01", month),
        "2026-03-02 2026-03-06 2026-03-13 2026-03-20 2026-03-27",
      );
    });

    it("counts a weekday within a month named by BYMONTH", () => {
      // Given the fourth Thursday of November, which is how Thanksgiving is
      // written and how most yearly recurrences with an ordinal are. BYMONTH
      // gives the ordinal a month to count within.
      const years = inWindow("2026-01-01T00:00", "2029-01-01T00:00");

      // When three years are read.
      // Then it lands once a year, in November.
      assertIdentical(
        days("FREQ=YEARLY;BYMONTH=11;BYDAY=4TH", "2026-01-01", years),
        "2026-11-26 2027-11-25 2028-11-23",
      );
    });

    it("selects days of the month", () => {
      // Given a recurrence on the 1st and the 15th.
      const quarter = inWindow("2026-01-01T00:00", "2026-03-01T00:00");

      // When two months are read.
      // Then it lands on each.
      assertIdentical(
        days("FREQ=MONTHLY;BYMONTHDAY=1,15", "2026-01-01", quarter),
        "2026-01-01 2026-01-15 2026-02-01 2026-02-15",
      );
    });

    it("counts a day of the month back from the end", () => {
      // Given the last day of every month, which BYMONTHDAY writes as -1.
      const quarter = inWindow("2026-01-01T00:00", "2026-04-01T00:00");

      // When a quarter is read.
      // Then each month gives up its own last day, February included.
      assertIdentical(
        days("FREQ=MONTHLY;BYMONTHDAY=-1", "2026-01-01", quarter),
        "2026-01-31 2026-02-28 2026-03-31",
      );
    });

    it("selects months", () => {
      // Given a yearly recurrence in two named months.
      const year = inWindow("2026-01-01T00:00", "2027-01-01T00:00");

      // When a year is read.
      // Then it lands on the start's day of the month in each.
      assertIdentical(
        days("FREQ=YEARLY;BYMONTH=3,9", "2026-01-15", year),
        "2026-03-15 2026-09-15",
      );
    });

    it("selects hours and minutes", () => {
      // Given a daily recurrence at two times of day.
      const day = inWindow("2026-03-11T00:00", "2026-03-12T00:00");

      // When one day is read.
      // Then each occurrence is the minute it starts in.
      assertIdentical(
        read(
          parseRRule("FREQ=DAILY;BYHOUR=9,17;BYMINUTE=30", {
            start: "2026-03-11",
          }),
          day,
        ),
        "[2026-03-11T09:30:00,2026-03-11T09:31:00) " +
          "[2026-03-11T17:30:00,2026-03-11T17:31:00)",
      );
    });
  });

  describe("time of day when only one part names it", () => {
    it("takes the hour from BYHOUR and the minute from the start", () => {
      // Given BYHOUR with no BYMINUTE, and a start carrying a clock time.
      const day = inWindow("2026-03-11T00:00", "2026-03-12T00:00");

      // When one day is read.
      // Then the hours come from the part and the minutes from DTSTART, which
      // is where RFC 5545 says an unnamed part is filled in from.
      assertIdentical(
        read(
          parseRRule("FREQ=DAILY;BYHOUR=7,19", { start: "2026-03-11T00:45" }),
          day,
        ),
        "[2026-03-11T07:45:00,2026-03-11T07:46:00) " +
          "[2026-03-11T19:45:00,2026-03-11T19:46:00)",
      );
    });

    it("falls back to midnight when neither the part nor the start says", () => {
      // Given BYMINUTE alone and a start with no clock time.
      const day = inWindow("2026-03-11T00:00", "2026-03-12T00:00");

      // When one day is read.
      // Then the hour is midnight, because nothing named one.
      assertIdentical(
        read(
          parseRRule("FREQ=DAILY;BYMINUTE=15", { start: "2026-03-11" }),
          day,
        ),
        "[2026-03-11T00:15:00,2026-03-11T00:16:00)",
      );
    });
  });

  describe("UNTIL", () => {
    it("includes the day it names", () => {
      // Given a daily recurrence bounded by a bare date.
      const month = inWindow("2026-03-01T00:00", "2026-04-01T00:00");

      // When March is read.
      // Then the named day is the last one covered.
      assertIdentical(
        days("FREQ=DAILY;UNTIL=20260314", "2026-03-11", month),
        "2026-03-11 2026-03-12 2026-03-13 2026-03-14",
      );
    });

    it("reads a UTC timestamp on the clock the rule is read in", () => {
      // Given an UNTIL late on the 14th in UTC, read in Tokyo, which is nine
      // hours ahead. The instant lands on the 15th there.
      const month = inWindow(
        "2026-03-01T00:00",
        "2026-04-01T00:00",
        "Asia/Tokyo",
      );
      const rule = parseRRule("FREQ=DAILY;UNTIL=20260314T230000Z", {
        start: "2026-03-11",
        zone: "Asia/Tokyo",
      });

      // When March is read.
      // Then the 15th is included, because that is the day the bound falls on
      // where the recurrence runs.
      const covered = daysOf(rule, month).split(" ");
      assertIdentical(covered.at(-1), "2026-03-15");
    });
  });

  describe("a floating UNTIL", () => {
    it("keeps the day it was written with, rather than converting it", () => {
      // Given an UNTIL late on the 14th with no Z, read in Tokyo. RFC 5545
      // reads a timestamp without a Z as local time, so the day it names is
      // the one written. Read as a UTC instant it would land on the 15th.
      const month = inWindow(
        "2026-03-01T00:00",
        "2026-04-01T00:00",
        "Asia/Tokyo",
      );
      const floating = parseRRule("FREQ=DAILY;UNTIL=20260314T230000", {
        start: "2026-03-11",
        zone: "Asia/Tokyo",
      });
      const instant = parseRRule("FREQ=DAILY;UNTIL=20260314T230000Z", {
        start: "2026-03-11",
        zone: "Asia/Tokyo",
      });

      // When each is read.
      // Then the floating one stops on the 14th and the UTC one runs to the
      // 15th, because that is the day the instant falls on in Tokyo.
      assertIdentical(daysOf(floating, month).split(" ").at(-1), "2026-03-14");
      assertIdentical(daysOf(instant, month).split(" ").at(-1), "2026-03-15");
    });
  });

  describe("refusing a recurrence", () => {
    it("requires a frequency", () => {
      // Given a recurrence with no FREQ, which RFC 5545 requires.
      // When it is parsed.
      // Then it is refused.
      assertIdentical(complaintAbout("INTERVAL=2"), "rrule: FREQ is required");
    });

    it("names a frequency that recurs faster than a day", () => {
      // Given an hourly recurrence. It is real, and `every` steps through
      // calendar periods, so there is nothing for it to become.
      // When it is parsed.
      // Then the message says which of those two things went wrong.
      assertIdentical(
        complaintAbout("FREQ=HOURLY"),
        "FREQ: HOURLY recurs faster than a day, and a rule steps through calendar periods",
      );
    });

    it("names a part it has no rule for, one at a time", () => {
      // Given the parts that exist and cannot be expressed.
      // When each is parsed.
      // Then each is refused by name, so a reader learns which one and why
      // rather than finding the recurrence quietly means something else.
      assertStringStartsWith(
        complaintAbout("FREQ=DAILY;COUNT=10"),
        "COUNT: a count of occurrences is not something a rule can express",
      );
      assertStringStartsWith(
        complaintAbout("FREQ=MONTHLY;BYSETPOS=-1"),
        "BYSETPOS:",
      );
      assertStringStartsWith(
        complaintAbout("FREQ=YEARLY;BYWEEKNO=20"),
        "BYWEEKNO:",
      );
      assertStringStartsWith(
        complaintAbout("FREQ=YEARLY;BYYEARDAY=100"),
        "BYYEARDAY:",
      );
      assertIdentical(
        complaintAbout("FREQ=DAILY;BYSECOND=30"),
        "BYSECOND: Quando reads recurrences down to the minute",
      );
    });

    it("refuses an ordinal with no month to count within", () => {
      // Given a weekly recurrence counting Mondays, and a yearly one with no
      // BYMONTH. An ordinal counts a weekday within a month, and neither of
      // those has one.
      // When each is parsed.
      // Then each is refused rather than the ordinal being dropped, and the
      // yearly one is told what would make it work.
      assertIdentical(
        complaintAbout("FREQ=WEEKLY;BYDAY=1MO"),
        "BYDAY: an ordinal counts a weekday within a month, so it needs FREQ=MONTHLY or FREQ=YEARLY with BYMONTH",
      );
      assertStringStartsWith(
        complaintAbout("FREQ=YEARLY;BYDAY=4TH"),
        "BYDAY: an ordinal under FREQ=YEARLY counts a weekday within the whole year",
      );
    });

    it("refuses a day of the month under a weekly recurrence", () => {
      // Given the pair RFC 5545 forbids. A week has no day of the month to
      // select, so intersecting the two would mean something the recurrence
      // never said.
      // When it is parsed.
      // Then it is refused.
      assertIdentical(
        complaintAbout("FREQ=WEEKLY;BYMONTHDAY=15"),
        "BYMONTHDAY: has no meaning under FREQ=WEEKLY",
      );
    });

    it("refuses an empty entry in the middle", () => {
      // Given a doubled separator in the parts and in a value. Something was
      // meant to be there, and skipping it quietly would accept a recurrence
      // one part short.
      // When each is parsed.
      // Then each is refused.
      assertStringStartsWith(complaintAbout("FREQ=WEEKLY;;BYDAY=MO"), "rrule:");
      assertStringStartsWith(
        complaintAbout("FREQ=WEEKLY;BYDAY=MO,,WE"),
        "BYDAY:",
      );
    });

    it("names a malformed part", () => {
      // Given a part with no value, a repeated part, and a made-up one.
      // When each is parsed.
      // Then each is refused.
      assertIdentical(
        complaintAbout("FREQ=DAILY;INTERVAL"),
        'rrule: "INTERVAL" is not a NAME=VALUE part',
      );
      assertIdentical(
        complaintAbout("FREQ=DAILY;INTERVAL=2;INTERVAL=3"),
        "INTERVAL: is given twice",
      );
      assertStringStartsWith(
        complaintAbout("FREQ=DAILY;BYFORTNIGHT=2"),
        'rrule: "BYFORTNIGHT" is not a recurrence rule part.',
      );
    });

    it("names a bad value", () => {
      // Given values outside their ranges and a weekday that is not one.
      // When each is parsed.
      // Then each names the part and the range it wanted.
      assertIdentical(
        complaintAbout("FREQ=DAILY;INTERVAL=0"),
        'INTERVAL: "0" is not a whole number of 1 or more',
      );
      assertIdentical(
        complaintAbout("FREQ=MONTHLY;BYMONTHDAY=32"),
        'BYMONTHDAY: "32" is out of range. Expected 1 to 31, or -1 to -31 counting back from the end',
      );
      assertStringStartsWith(
        complaintAbout("FREQ=WEEKLY;BYDAY=XX"),
        'BYDAY: "XX" is not a weekday.',
      );
      assertStringStartsWith(
        complaintAbout("FREQ=DAILY;UNTIL=soon"),
        'UNTIL: "soon" is not a date.',
      );
    });

    it("names an unreadable UNTIL timestamp and weekday start", () => {
      // Given an UNTIL whose date part is not a real date, and a WKST that is
      // not a weekday.
      // When each is parsed.
      // Then each is refused by the part it belongs to.
      assertIdentical(
        complaintAbout("FREQ=DAILY;UNTIL=20261345"),
        'UNTIL: "20261345" is not a date',
      );
      assertIdentical(
        complaintAbout("FREQ=DAILY;UNTIL=20261345T120000Z"),
        'UNTIL: "20261345T120000Z" is not a date and time',
      );
      // Checked wherever it appears, not only where it changes the answer.
      assertIdentical(
        complaintAbout("FREQ=WEEKLY;INTERVAL=2;WKST=XX"),
        'WKST: "XX" is not a weekday',
      );
      assertIdentical(
        complaintAbout("FREQ=WEEKLY;WKST=XX"),
        'WKST: "XX" is not a weekday',
      );
    });

    it("refuses an ordinal no month can hold", () => {
      // Given a sixth Monday, which no month has.
      // When it is parsed.
      // Then it is refused with the range that works.
      assertStringStartsWith(
        complaintAbout("FREQ=MONTHLY;BYDAY=6MO"),
        'BYDAY: "6MO" counts an occurrence no month holds.',
      );
    });

    it("ignores a trailing separator", () => {
      // Given a recurrence with a trailing semicolon, which generated
      // calendar data often carries.
      const week = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

      // When it is parsed.
      // Then the empty piece is skipped rather than refused as a bad part.
      assertIdentical(
        days("FREQ=WEEKLY;BYDAY=WE;", "2026-03-09", week),
        "2026-03-11",
      );
    });

    it("names a start that is not a date", () => {
      // Given a start Temporal cannot read.
      // When it is parsed.
      // Then the message shows both shapes that work.
      assertStringStartsWith(
        complaintAbout("FREQ=DAILY", "next Tuesday"),
        'start: "next Tuesday" is not a date.',
      );
    });
  });

  describe("time zones", () => {
    it("runs a stepped cycle on the zone it names", () => {
      // Given a fortnightly recurrence in Tokyo, read from London.
      const month = inWindow("2026-03-09T00:00", "2026-04-06T00:00");
      const rule = parseRRule("FREQ=WEEKLY;INTERVAL=2", {
        start: "2026-03-11T09:00",
        zone: "Asia/Tokyo",
      });

      // When four weeks are read.
      // Then the occurrences are Tokyo's 09:00, which is midnight in London.
      assertIdentical(
        render(intervals(rule, month)),
        "[2026-03-11T00:00:00,2026-03-11T00:01:00) " +
          "[2026-03-25T00:00:00,2026-03-25T00:01:00)",
      );
    });
  });

  describe("what it is for", () => {
    it("answers the next occurrences, skipping holidays", () => {
      // Given a standup every weekday morning and a two-day shutdown.
      const standup = parseRRule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", {
        start: "2026-03-30T09:30",
      });
      const shutdown = dates("2026-04-03", "2026-04-06");

      // When the next five are taken from the start of that week.
      const next = take(
        intervals(standup.except(shutdown), inWindow("2026-03-30T00:00")),
        5,
      );

      // Then Good Friday and Easter Monday are missing, and the fifth is the
      // Tuesday after the break.
      assertIdentical(
        [...next]
          .map((interval) => interval.start?.toPlainDate().toString())
          .join(" "),
        "2026-03-30 2026-03-31 2026-04-01 2026-04-02 2026-04-07",
      );
    });

    it("reads the RFC's own monthly example", () => {
      // Given "the last Friday of the month" as RFC 5545 writes it, bounded.
      const rule = "FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20260630";
      const halfYear = inWindow("2026-01-01T00:00", "2026-12-01T00:00");

      // When the year is read.
      // Then it runs to the bound and stops.
      assertIdentical(
        days(rule, "2026-01-01", halfYear),
        "2026-01-30 2026-02-27 2026-03-27 2026-04-24 2026-05-29 2026-06-26",
      );
    });
  });
});
