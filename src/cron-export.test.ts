import { inWindow, render } from "#test/intervals.js";
import {
  assertFalse,
  assertIdentical,
  assertStringIncludes,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  always,
  any,
  between,
  dates,
  daysOfMonth,
  daysOfWeek,
  inZone,
  monthsOfYear,
  never,
  nthDayOfWeekInMonth,
  timeOfDay,
  weekdays,
} from "./build.js";
import { parseCron } from "./cron.js";
import { toCron } from "./cron-export.js";
import { every } from "./every-builders.js";
import { intervals } from "./interpret.js";
import type { Rule } from "./rule.js";

describe("writing a rule as a cron expression", () => {
  /** The expression a rule comes to. Fails the test when it has none. */
  const written = (rule: Rule): string => {
    const result = toCron(rule);
    assertTrue(result.ok);
    return result.cron;
  };

  /** Why a rule has no cron expression. Fails the test when it has one. */
  const refusal = (rule: Rule): string => {
    const result = toCron(rule);
    assertFalse(result.ok);
    return result.reason;
  };

  /** Midnight to a minute past, so a rule has a clock time to write. */
  const MIDNIGHT = timeOfDay("00:00", "00:01");

  describe("the expression a rule comes to", () => {
    it("writes the minute a rule covers as the fields that fire in it", () => {
      // Given a rule covering one minute of each weekday morning.
      const batch = weekdays().and(timeOfDay("06:00", "06:01"));

      // When it is written out.
      // Then it is the cron line that fires in that minute.
      assertIdentical(written(batch), "0 6 * * 1-5");
    });

    it("writes a window as every minute of the hours it covers", () => {
      // Given office hours, which cover eight whole hours rather than an
      // instant. Cron has no duration, so the expression fires throughout.
      const office = timeOfDay("09:00", "17:00");

      // When it is written out.
      // Then every minute of the nine hours up to but not including 17:00.
      assertIdentical(written(office), "* 9-16 * * *");
    });

    it("leaves a field open when the rule says nothing about it", () => {
      // Given a rule that narrows nothing at all.
      // When it is written out.
      // Then five stars, which is cron for every minute.
      assertIdentical(written(always()), "* * * * *");
    });

    it("writes months by number and Sunday as zero", () => {
      // Given Christmas morning, and a Sunday rule, which is where cron's
      // numbering is easiest to get wrong.
      const christmas = monthsOfYear("december").and(daysOfMonth(25), MIDNIGHT);
      const sunday = daysOfWeek("sunday").and(MIDNIGHT);

      // When they are written out.
      // Then December is 12 and Sunday is 0.
      assertIdentical(written(christmas), "0 0 25 12 *");
      assertIdentical(written(sunday), "0 0 * * 0");
    });

    it("joins consecutive values into a range", () => {
      // Given days scattered across the month, two of them next to each other.
      const days = daysOfMonth(1, 8, 9, 10, 20).and(MIDNIGHT);

      // When it is written out.
      // Then the run becomes a range and the rest stay as they are.
      assertIdentical(written(days), "0 0 1,8-10,20 * *");
    });
  });

  describe("the two day fields", () => {
    it("writes a union of the day fields, which is what cron reads", () => {
      // Given the 13th of the month or any Friday. Cron reads two restricted
      // day fields as either one matching, so this is the shape it has.
      const either = any(daysOfMonth(13), daysOfWeek("friday")).and(MIDNIGHT);

      // When it is written out.
      // Then both fields are restricted, and neither is a star.
      assertIdentical(written(either), "0 0 13 * 5");
    });

    it("flattens alternatives written inside alternatives", () => {
      // Given the same union, nested the way a rule built up in pieces is.
      const either = any(daysOfMonth(13), any(daysOfWeek("friday"))).and(
        MIDNIGHT,
      );

      // When it is written out.
      // Then the nesting makes no difference to the fields it comes to.
      assertIdentical(written(either), "0 0 13 * 5");
    });

    it("refuses a day of the month and a weekday that must match together", () => {
      // Given Friday the 13th, which needs both to hold at once.
      const friday13th = daysOfMonth(13).and(daysOfWeek("friday"), MIDNIGHT);

      // When it is written out.
      // Then it is refused, because the expression that looks right reads as
      // the union and would fire on five days a month rather than none.
      assertStringIncludes(
        refusal(friday13th),
        "cron reads two restricted day fields as either one matching",
      );
    });
  });

  describe("reading it back", () => {
    it("comes back as the expression it was read from", () => {
      // Given expressions using each part of the grammar that has one form.
      const expressions = [
        "0 6 * * 1-5",
        "* * * * *",
        "0 0 1 1 *",
        "0 0 13 * 5",
        "0 0 * * 0",
        "30 6 1,15 * *",
        "0,30 9-17 * 3,6,9,12 *",
      ];

      // When each is read as a rule and written back out.
      const back = expressions.map((text) => written(parseCron(text)));

      // Then nothing has changed.
      assertIdentical(back.join(" | "), expressions.join(" | "));
    });

    it("covers the same minutes as the expression it came from", () => {
      // Given a weekday batch job, over the Monday it first runs on.
      const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");
      const covers = (rule: Rule): string => render(intervals(rule, monday));

      // When the rule it reads as is written out and read again.
      const again = parseCron(written(parseCron("0 6 * * 1-5")));

      // Then the same minute, checked against the time itself rather than
      // against the other rule, which would pass if both covered nothing.
      assertIdentical(
        covers(again),
        "[2026-03-09T06:00:00,2026-03-09T06:01:00)",
      );
    });

    it("takes the clock from a leaf inside an alternative", () => {
      // Given two firing times, each pinned to the daemon's own zone.
      const tokyo = any(
        timeOfDay("09:00", "09:01", "Asia/Tokyo"),
        timeOfDay("17:00", "17:01", "Asia/Tokyo"),
      );

      // When it is written out.
      const result = toCron(tokyo);

      // Then the zone is lifted out of the alternatives to the whole of it.
      assertTrue(result.ok);
      assertIdentical(result.cron, "0 9,17 * * *");
      assertIdentical(result.zone, "Asia/Tokyo");
    });

    it("carries the clock the daemon runs on", () => {
      // Given a cron expression pinned to a daemon's own zone.
      const tokyo = parseCron("0 9 * * *", { zone: "Asia/Tokyo" });

      // When it is written out.
      const result = toCron(tokyo);

      // Then the zone comes back beside the expression, because cron itself
      // has no field for it.
      assertTrue(result.ok);
      assertIdentical(result.cron, "0 9 * * *");
      assertIdentical(result.zone, "Asia/Tokyo");
    });
  });

  describe("what cron has no field for", () => {
    it("refuses an exclusion", () => {
      // Given weekdays with the holidays taken out.
      const running = weekdays().and(MIDNIGHT).except(dates("2026-04-03"));

      // When it is written out.
      // Then it is refused. Cron selects times and never removes them.
      assertStringIncludes(
        refusal(running),
        "it excludes times, and both notations only select them",
      );
    });

    it("refuses named dates and bounded ranges, which need a year", () => {
      // Given a rule pinned to the calendar rather than repeating on it.
      // A cron expression repeats forever and has no year field.
      assertStringIncludes(
        refusal(dates("2026-04-03")),
        "it names calendar dates, and cron has no year field",
      );
      assertStringIncludes(
        refusal(between("2026-04-01", "2026-04-30").and(MIDNIGHT)),
        "it is bounded to a stretch of the calendar",
      );
    });

    it("refuses a cycle counted from a date", () => {
      // Given a fortnightly rule. Cron's steps restart within each month, so
      // there is no field that counts from an anchor.
      const fortnightly = every(2, "weeks", { anchor: "2026-03-02" });

      assertStringIncludes(
        refusal(fortnightly.and(MIDNIGHT)),
        "cron only repeats within a month, a week and a day",
      );
    });

    it("refuses a weekday counted within the month", () => {
      // Given the first Monday of the month, which POSIX cron cannot say.
      const standup = nthDayOfWeekInMonth(1, "monday").and(MIDNIGHT);

      assertStringIncludes(refusal(standup), "a Quartz extension");
    });

    it("refuses days counted back from the end of the month", () => {
      assertStringIncludes(
        refusal(daysOfMonth(-1).and(MIDNIGHT)),
        "counts days back from the end of the month",
      );
    });

    it("refuses a window that is not a set of hours times a set of minutes", () => {
      // Given a window offset by half an hour. Its minutes are 09:30 through
      // 17:29, and no pair of clock fields selects those.
      const offset = timeOfDay("09:30", "17:30");

      assertStringIncludes(
        refusal(offset),
        "not a set of hours crossed with a set of minutes",
      );
    });

    it("refuses a rule read on two clocks at once", () => {
      // Given a rule whose zone disagrees with the one around it.
      const split = inZone(
        "Europe/London",
        timeOfDay("09:00", "09:01", "Asia/Tokyo"),
      );

      assertStringIncludes(refusal(split), "runs on one clock");
    });

    it("refuses a rule naming the same field twice", () => {
      // Given two clock windows that have to hold together. Cron has one pair
      // of clock fields, and no way to write an intersection of two.
      const twice = timeOfDay("09:00", "12:00").and(
        timeOfDay("11:00", "14:00"),
      );

      assertStringIncludes(refusal(twice), "twice, and cron has one field");
    });

    it("refuses a rule covering no time", () => {
      assertStringIncludes(refusal(never()), "there is nothing to write");
    });

    it("refuses an alternative that is not a single selection", () => {
      // Given an alternative holding a whole compound rule. Cron's union is
      // between two fields, and a field holds selections and nothing else.
      const beside = any(weekdays().and(MIDNIGHT), daysOfMonth(1));
      const nested = any(any(weekdays().and(MIDNIGHT)), daysOfMonth(1));

      // Then it is refused however deep it sits, rather than the flattening
      // losing sight of it.
      assertStringIncludes(
        refusal(beside),
        "an alternative has to be a single selection",
      );
      assertStringIncludes(
        refusal(nested),
        "an alternative has to be a single selection",
      );
    });

    it("refuses an alternative with nothing in it", () => {
      // Given a union of no rules, which covers no time.
      assertStringIncludes(refusal(any()), "covers no time");
    });
  });
});
