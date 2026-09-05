import { inWindow, render } from "#test/intervals.js";
import {
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  any,
  between,
  dates,
  daysOfMonth,
  daysOfWeek,
  inZone,
  monthsOfYear,
  nthDayOfWeekInMonth,
  onOrAfter,
  timeOfDay,
  weekdays,
} from "./build.js";
import { every } from "./every-builders.js";
import { intervals } from "./interpret.js";
import type { Rule } from "./rule.js";
import { parseRRule } from "./rrule.js";
import {
  toRRule,
  type ToRRuleOptions,
  type WrittenRRule,
} from "./rrule-export.js";

describe("writing a rule as a recurrence rule", () => {
  /** The recurrence a rule comes to. Fails the test when it has none. */
  const written = (rule: Rule, options?: ToRRuleOptions): WrittenRRule => {
    const result = toRRule(rule, options);
    assertTrue(result.ok);
    return result;
  };

  /** Why a rule has no recurrence. Fails the test when it has one. */
  const refusal = (rule: Rule, options?: ToRRuleOptions): string => {
    const result = toRRule(rule, options);
    assertFalse(result.ok);
    return result.reason;
  };

  /** A start for the rules that do not bound themselves. */
  const FROM_MARCH: ToRRuleOptions = { start: "2026-03-02" };

  describe("the recurrence a rule comes to", () => {
    it("writes a weekly pattern as the days it runs on", () => {
      // Given a standup, as the minute it starts in on each weekday.
      const standup = weekdays().and(timeOfDay("09:30", "09:31"));

      // When it is written out.
      const result = written(standup, FROM_MARCH);

      // Then a weekly recurrence, with DTSTART carrying the time of day.
      assertIdentical(result.rrule, "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
      assertIdentical(result.start, "2026-03-02T09:30");
      assertIdentical(result.duration, "PT1M");
    });

    it("carries how long an occurrence runs, which no RRULE says", () => {
      // Given office hours, which cover eight hours rather than an instant.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));

      // When it is written out.
      const result = written(office, FROM_MARCH);

      // Then the recurrence says when and the duration says how long, which
      // is the split RFC 5545 makes between RRULE and DTEND.
      assertIdentical(result.rrule, "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
      assertIdentical(result.start, "2026-03-02T09:00");
      assertIdentical(result.duration, "PT8H");
    });

    it("writes a rule about whole days as a date, lasting a day", () => {
      // Given a rule with no clock in it at all.
      const result = written(weekdays(), FROM_MARCH);

      // Then DTSTART is a bare date, which is what an all-day entry has.
      assertIdentical(result.start, "2026-03-02");
      assertIdentical(result.duration, "P1D");
    });

    it("says yearly when the rule names a month and a day of it", () => {
      // Given Christmas Day.
      const christmas = monthsOfYear("december").and(daysOfMonth(25));

      // When it is written out.
      // Then yearly, which is what a calendar showing it should say. Daily
      // with the same two parts covers the same day and reads as nonsense.
      assertIdentical(
        written(christmas, FROM_MARCH).rrule,
        "FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25",
      );
    });

    it("says monthly when it counts a weekday within the month", () => {
      // Given the first Monday of every month. An ordinal in BYDAY has no
      // meaning under a daily or weekly frequency.
      assertIdentical(
        written(nthDayOfWeekInMonth(1, "monday"), FROM_MARCH).rrule,
        "FREQ=MONTHLY;BYDAY=1MO",
      );
    });

    it("writes both kinds of day selection into the one BYDAY", () => {
      // Given the first Monday of the month or any Friday.
      const both = any(nthDayOfWeekInMonth(1, "monday"), daysOfWeek("friday"));

      // When it is written out.
      // Then one part, counted days first, which is how it comes apart again.
      assertIdentical(
        written(both, FROM_MARCH).rrule,
        "FREQ=MONTHLY;BYDAY=1MO,FR",
      );
    });

    it("writes several start times as the hours and minutes they are", () => {
      // Given a job at 09:00 and 17:00, as the minutes it starts in.
      const twice = any(
        timeOfDay("09:00", "09:01"),
        timeOfDay("17:00", "17:01"),
      );

      // When it is written out.
      // Then BYHOUR names both and BYMINUTE stays out, because the one minute
      // they share is already in DTSTART.
      const result = written(twice, FROM_MARCH);
      assertIdentical(result.rrule, "FREQ=DAILY;BYHOUR=9,17");
      assertIdentical(result.start, "2026-03-02T09:00");
    });
  });

  describe("where the recurrence begins and ends", () => {
    it("takes DTSTART from the rule's own lower bound", () => {
      // Given a rule that already says when it starts.
      const standup = onOrAfter("2026-03-30").and(weekdays());

      // When it is written out with no start of its own.
      // Then the rule's bound is DTSTART, and nothing else was needed.
      assertIdentical(written(standup).start, "2026-03-30");
    });

    it("refuses a rule that never says when it begins", () => {
      // Given every Monday there has ever been, which is what the rule means.
      // When it is written out with nothing to start it.
      // Then it is refused, because DTSTART is not optional in RFC 5545 and
      // choosing one quietly would throw away the past.
      assertStringIncludes(
        refusal(weekdays()),
        "every recurrence starts at DTSTART",
      );
    });

    it("bounds a whole-day recurrence with a date", () => {
      // Given a rule pinned to one stretch of the calendar.
      const quarter = between("2026-04-01", "2026-06-30");

      // When it is written out.
      // Then UNTIL is a date, which is the value type a date DTSTART needs.
      const result = written(quarter);
      assertIdentical(result.rrule, "FREQ=DAILY;UNTIL=20260630");
      assertIdentical(result.start, "2026-04-01");
    });

    it("bounds a timed recurrence at the end of its last day", () => {
      // Given the same stretch, with a time of day on it. UNTIL has to be the
      // same kind of value as DTSTART, so a date will not do.
      const quarter = between("2026-04-01", "2026-06-30").and(
        timeOfDay("09:00", "09:01"),
      );

      // When it is written out with no zone.
      // Then the last day ends at 23:59:59 UTC, which is the reading a
      // recurrence with no zone gets going the other way too.
      assertIdentical(
        written(quarter).rrule,
        "FREQ=DAILY;UNTIL=20260630T235959Z",
      );
    });

    it("throws for a start that is not a date", () => {
      // Given a start the caller got wrong, rather than a rule that has no
      // recurrence. The two are different, and only one is an answer.
      const error = assertThrowsError(() =>
        toRRule(weekdays(), { start: "next tuesday" }),
      );
      assertInstanceOf(error, RangeError);
    });
  });

  describe("a cycle of periods", () => {
    it("writes the days a whole period covers", () => {
      // Given every other week, whole. A weekly recurrence names one day of
      // the week, so covering the week means naming all seven.
      const fortnight = every(2, "weeks", { anchor: "2026-03-02" });

      assertIdentical(
        written(fortnight, FROM_MARCH).rrule,
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,WE,TH,FR,SA,SU",
      );
    });

    it("writes WKST when the cycle's weeks do not start on Monday", () => {
      // Given a fortnightly cycle anchored on a Sunday. Which days share a
      // week decides which fortnight they are in, and RFC 5545 takes that
      // from WKST rather than from DTSTART.
      const fortnight = every(2, "weeks", { anchor: "2026-03-01" }).and(
        daysOfWeek("monday"),
      );

      assertIdentical(
        written(fortnight, { start: "2026-03-01" }).rrule,
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;WKST=SU",
      );
    });

    it("leaves WKST out when the weeks start where RFC 5545 assumes", () => {
      // Given the same cycle anchored on a Monday, which is the default.
      const fortnight = every(2, "weeks", { anchor: "2026-03-02" }).and(
        daysOfWeek("monday"),
      );

      assertIdentical(
        written(fortnight, FROM_MARCH).rrule,
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
      );
    });

    it("keeps the months a yearly cycle already names", () => {
      // Given every other year, narrowed to one date in it. A yearly cycle
      // covering whole years writes out every month, and this one does not
      // cover whole years.
      const biennial = every(2, "years", { anchor: "2026-03-04" }).and(
        monthsOfYear("march"),
        daysOfMonth(4),
      );

      assertIdentical(
        written(biennial, { start: "2026-03-04" }).rrule,
        "FREQ=YEARLY;INTERVAL=2;BYMONTH=3;BYMONTHDAY=4",
      );
    });

    it("refuses a start the cycle does not reach", () => {
      // Given a fortnightly cycle and a start in the week between two of its
      // weeks. DTSTART is the first occurrence, and that day is not one.
      const fortnight = every(2, "weeks", { anchor: "2026-03-02" });

      assertStringIncludes(
        refusal(fortnight, { start: "2026-03-09" }),
        "which its cycle of 2 weeks does not reach",
      );
    });
  });

  describe("reading it back", () => {
    it("comes back as the recurrence it was read from", () => {
      // Given recurrences using each part that has a rule to map onto.
      const recurrences: readonly (readonly [string, string])[] = [
        ["FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "2026-03-30T09:30"],
        ["FREQ=DAILY", "2026-03-30T09:00"],
        ["FREQ=MONTHLY;BYDAY=1MO", "2026-03-02"],
        ["FREQ=YEARLY;BYMONTH=11;BYDAY=4TH", "2026-11-26"],
        ["FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;WKST=SU", "2026-03-01"],
        ["FREQ=DAILY;UNTIL=20261231", "2026-03-30"],
        ["FREQ=DAILY;UNTIL=20261231T235959Z", "2026-03-30T09:00"],
        ["FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15", "2026-03-15T08:00"],
        ["FREQ=DAILY;BYHOUR=9,17", "2026-03-30T09:00"],
        ["FREQ=DAILY;BYMINUTE=0,30", "2026-03-30T09:00"],
      ];

      // When each is read as a rule and written back out.
      const back = recurrences.map(([text, start]) => {
        const result = written(parseRRule(text, { start }));
        return `${result.rrule} @ ${result.start}`;
      });

      // Then both the recurrence and its DTSTART are unchanged.
      assertIdentical(
        back.join(" | "),
        recurrences.map(([text, start]) => `${text} @ ${start}`).join(" | "),
      );
    });

    it("covers the same occurrences as the recurrence it came from", () => {
      // Given a weekly standup, over the March it starts in.
      const march = inWindow("2026-03-01T00:00", "2026-04-01T00:00");
      const result = written(
        parseRRule("FREQ=WEEKLY;BYDAY=MO", {
          start: "2026-03-02T09:00",
        }),
      );

      // When what was written is read again.
      const again = parseRRule(result.rrule, { start: result.start });

      // Then every Monday morning of the month, asserted against the calendar
      // rather than against the other rule, which would agree about nothing.
      assertIdentical(
        render(intervals(again, march)),
        [
          "[2026-03-02T09:00:00,2026-03-02T09:01:00)",
          "[2026-03-09T09:00:00,2026-03-09T09:01:00)",
          "[2026-03-16T09:00:00,2026-03-16T09:01:00)",
          "[2026-03-23T09:00:00,2026-03-23T09:01:00)",
          "[2026-03-30T09:00:00,2026-03-30T09:01:00)",
        ].join(" "),
      );
    });

    it("moves DTSTART to the first time the recurrence runs at", () => {
      // Given a recurrence whose DTSTART is not one of its own occurrences.
      // BYHOUR overrides the hour, so midnight is never one of them.
      const odd = parseRRule("FREQ=DAILY;BYHOUR=9,17", {
        start: "2026-03-30T00:00",
      });

      // When it is written out.
      // Then DTSTART is 09:00, which RFC 5545 says the first occurrence is.
      assertIdentical(written(odd).start, "2026-03-30T09:00");
    });

    it("carries the clock the recurrence runs on", () => {
      // Given a recurrence pinned to a zone, bounded at the end of a day.
      const tokyo = parseRRule("FREQ=DAILY;UNTIL=20261231T145959Z", {
        start: "2026-03-30T09:00",
        zone: "Asia/Tokyo",
      });

      // When it is written out.
      const result = written(tokyo);

      // Then the zone comes back beside the recurrence, and UNTIL is still
      // the instant that day ends in Tokyo.
      assertIdentical(result.rrule, "FREQ=DAILY;UNTIL=20261231T145959Z");
      assertIdentical(result.zone, "Asia/Tokyo");
    });
  });

  describe("what a recurrence cannot say", () => {
    it("refuses an exclusion", () => {
      const running = weekdays().except(dates("2026-04-03"));

      assertStringIncludes(
        refusal(running, FROM_MARCH),
        "it excludes times, and both notations only select them",
      );
    });

    it("refuses named dates, which are RDATE rather than RRULE", () => {
      assertStringIncludes(
        refusal(dates("2026-04-03"), FROM_MARCH),
        "Dates go beside it as RDATE properties",
      );
    });

    it("refuses days of the month inside a weekly cycle", () => {
      // Given a fortnightly cycle narrowed to the 1st. RFC 5545 forbids the
      // pair, because a week has no day of the month to select.
      const wrong = every(2, "weeks", { anchor: "2026-03-02" }).and(
        daysOfMonth(1),
      );

      assertStringIncludes(
        refusal(wrong, FROM_MARCH),
        "a week has no day of the month to select",
      );
    });

    it("refuses an ordinal inside a daily cycle", () => {
      // Given every other day, narrowed to the first Monday of the month. The
      // cycle wants FREQ=DAILY and the ordinal needs a month to count in.
      const wrong = every(2, "days", { anchor: "2026-03-02" }).and(
        nthDayOfWeekInMonth(1, "monday"),
      );

      assertStringIncludes(
        refusal(wrong, FROM_MARCH),
        "counts within a month only under FREQ=MONTHLY or FREQ=YEARLY",
      );
    });

    it("refuses occurrences of different lengths", () => {
      // Given an hour in the morning and half an hour in the afternoon. One
      // recurrence carries one duration.
      const uneven = any(
        timeOfDay("09:00", "10:00"),
        timeOfDay("14:00", "14:30"),
      );

      assertStringIncludes(
        refusal(uneven, FROM_MARCH),
        "not all the same length",
      );
    });

    it("refuses start times that are not a set of hours times a set of minutes", () => {
      // Given 09:00 and 14:30. BYHOUR and BYMINUTE would also select 09:30
      // and 14:00, which the rule does not cover.
      const scattered = any(
        timeOfDay("09:00", "09:01"),
        timeOfDay("14:30", "14:31"),
      );

      assertStringIncludes(
        refusal(scattered, FROM_MARCH),
        "all BYHOUR and BYMINUTE can select",
      );
    });

    it("refuses a rule read on two clocks at once", () => {
      const split = inZone(
        "Europe/London",
        timeOfDay("09:00", "09:01", "Asia/Tokyo"),
      );

      assertStringIncludes(refusal(split, FROM_MARCH), "runs on one clock");
    });

    it("refuses a rule naming the same part twice", () => {
      // Given two days of the month that have to hold together, which covers
      // nothing and has one part to be written into.
      const twice = daysOfMonth(1).and(daysOfMonth(2));

      assertStringIncludes(
        refusal(twice, FROM_MARCH),
        "it names BYMONTHDAY twice",
      );
    });

    it("refuses a union of cycles, or of date ranges", () => {
      // Given rules offering a choice of the two parts a recurrence has
      // exactly one of.
      const cycles = any(
        every(2, "weeks", { anchor: "2026-03-02" }),
        every(3, "weeks", { anchor: "2026-03-02" }),
      );
      const ranges = any(
        between("2026-04-01", "2026-04-30"),
        between("2026-06-01", "2026-06-30"),
      );

      assertStringIncludes(refusal(cycles, FROM_MARCH), "a union of cycles");
      assertStringIncludes(
        refusal(ranges, FROM_MARCH),
        "a union of date ranges",
      );
    });

    it("refuses a rule naming BYDAY twice", () => {
      // Given Mondays and the first Tuesday of the month, which have to hold
      // together. Both belong in BYDAY, and a recurrence has one of those.
      const twice = daysOfWeek("monday").and(nthDayOfWeekInMonth(1, "tuesday"));

      assertStringIncludes(refusal(twice, FROM_MARCH), "it names BYDAY twice");
    });

    it("refuses a union of two different kinds of selection", () => {
      // Given the 13th of the month or any Friday, which is cron's union and
      // not one a recurrence has anywhere but BYDAY.
      const either = any(daysOfMonth(13), daysOfWeek("friday"));

      assertStringIncludes(
        refusal(either, FROM_MARCH),
        "a recurrence's only union is BYDAY",
      );
    });
  });
});
