import { when } from "#test/intervals.js";
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
  daysOfMonth,
  every,
  inCalendar,
  monthsOfYear,
  weekdays,
} from "./build.js";
import { canonical } from "./canonical.js";
import type { Context } from "./context.js";
import { toCron } from "./cron-export.js";
import { intervals } from "./interpret.js";
import { parseRule } from "./parse.js";
import { activeAt } from "./query.js";
import { explainRule } from "./rule-explanation.js";

describe("reading a rule on another calendar", () => {
  const JERUSALEM = "Asia/Jerusalem";

  /** The first five months of 2026, in Jerusalem. */
  const earlyYear = (): Context => ({
    from: Temporal.ZonedDateTime.from(`2026-01-01T00:00[${JERUSALEM}]`),
    to: Temporal.ZonedDateTime.from(`2026-06-01T00:00[${JERUSALEM}]`),
  });

  /** The ISO dates a rule's intervals start on, as one readable line. */
  const startDates = (rule: Parameters<typeof intervals>[0]): string =>
    [...intervals(rule, earlyYear())]
      .map((interval) => interval.start?.toPlainDate().toString() ?? "*")
      .join(" ");

  describe("what the calendar changes", () => {
    it("reads the first of the month on the calendar named", () => {
      // Given the first day of each month, read on the Hebrew calendar.
      const roshChodesh = inCalendar("hebrew", daysOfMonth(1));

      // When the first five months of 2026 are evaluated.
      // Then the answer is Rosh Chodesh, which falls where the Hebrew months
      // begin rather than where the Gregorian ones do.
      assertIdentical(
        startDates(roshChodesh),
        "2026-01-19 2026-02-18 2026-03-19 2026-04-18 2026-05-17",
      );
    });

    it("gives a different answer on a different calendar", () => {
      // Given the same rule read on the Islamic calendar.
      const islamicMonths = inCalendar("islamic-umalqura", daysOfMonth(1));

      // When the same window is evaluated.
      // Then the months begin elsewhere. The rule document is identical and
      // only the calendar it counts on differs.
      assertIdentical(
        startDates(islamicMonths),
        "2026-01-20 2026-02-18 2026-03-20 2026-04-18 2026-05-18",
      );
    });

    it("leaves a rule outside the wrapper on the ISO calendar", () => {
      // Given the same rule with no calendar named.
      // When it is evaluated over the same window.
      // Then it covers the first of each Gregorian month, unchanged.
      assertIdentical(
        startDates(daysOfMonth(1)),
        "2026-01-01 2026-02-01 2026-03-01 2026-04-01 2026-05-01",
      );
    });

    it("takes the innermost calendar where two are nested", () => {
      // Given a Hebrew rule holding an Islamic one.
      const nested = inCalendar(
        "hebrew",
        inCalendar("islamic-umalqura", daysOfMonth(1)),
      );

      // When it is evaluated.
      // Then the inner calendar decides, the same way the inner zone does.
      const islamicOnly = inCalendar("islamic-umalqura", daysOfMonth(1));
      assertIdentical(startDates(nested), startDates(islamicOnly));
    });

    it("composes with a rule counting on the ISO calendar", () => {
      // Given Rosh Chodesh that falls on a weekday.
      const workingRoshChodesh = inCalendar("hebrew", daysOfMonth(1)).and(
        weekdays(),
      );

      // When the window is evaluated.
      // Then the three on weekdays survive and the April and May ones, a
      // Saturday and a Sunday, do not. A weekday is the same seven-day cycle
      // on every calendar here, so it needs no wrapper of its own.
      assertIdentical(
        startDates(workingRoshChodesh),
        "2026-01-19 2026-02-18 2026-03-19",
      );
    });
  });

  describe("what comes back", () => {
    it("answers in the calendar the query was asked in", () => {
      // Given a Hebrew rule evaluated from an ordinary ISO instant.
      const roshChodesh = inCalendar("hebrew", daysOfMonth(1));

      // When the first interval is read back.
      const [first] = [...intervals(roshChodesh, earlyYear())];

      // Then it prints as an ordinary instant. Which calendar a rule counted
      // on is how it was written, not part of the answer.
      assertIdentical(
        first?.start?.toString(),
        `2026-01-19T00:00:00+02:00[${JERUSALEM}]`,
      );
    });

    it("answers a point query the same way", () => {
      // Given the first day of a Hebrew month, and a day that is not one.
      const roshChodesh = inCalendar("hebrew", daysOfMonth(1));

      // When two instants are checked.
      // Then the calendar decides which is covered.
      assertTrue(activeAt(roshChodesh, when("2026-01-19T10:00", JERUSALEM)));
      assertFalse(activeAt(roshChodesh, when("2026-01-01T10:00", JERUSALEM)));
    });
  });

  describe("where the vocabulary is Gregorian", () => {
    it("refuses a month named on another calendar", () => {
      // Given a month name read on the Hebrew calendar.
      const wrong = inCalendar("hebrew", monthsOfYear("january"));

      // When it is evaluated.
      const error = assertThrowsError(() => [...intervals(wrong, earlyYear())]);

      // Then it is refused. A Hebrew year holds twelve months or thirteen, and
      // the index a Gregorian name maps to moves in a leap year. Answering
      // would select the wrong month and say nothing about it.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, "monthsOfYear()");
      assertStringIncludes(error.message, "hebrew");
    });

    it("refuses a cycle of months on another calendar", () => {
      // Given a two-month cycle read on the Hebrew calendar.
      const wrong = inCalendar(
        "hebrew",
        every(2, "months", { anchor: "2026-01-01" }),
      );

      // When it is evaluated.
      const error = assertThrowsError(() => [...intervals(wrong, earlyYear())]);

      // Then it is refused for the same reason.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, "every()");
    });

    it("counts days and weeks on any calendar", () => {
      // Given a fortnightly cycle read on the Hebrew calendar.
      const fortnightly = inCalendar(
        "hebrew",
        every(2, "weeks", { anchor: "2026-01-07" }),
      );

      // When it is evaluated.
      // Then it answers. A week is seven days wherever it is counted, and the
      // anchor is read on the same calendar as the days being walked.
      assertIdentical(
        startDates(fortnightly),
        "2026-01-07 2026-01-21 2026-02-04 2026-02-18 2026-03-04 2026-03-18 " +
          "2026-04-01 2026-04-15 2026-04-29 2026-05-13 2026-05-27",
      );
    });

    it("refuses an unknown calendar where the rule is written", () => {
      // Given a calendar no runtime implements.
      const error = assertThrowsError(() =>
        inCalendar("julian-ish", daysOfMonth(1)),
      );

      // Then it fails at the point of writing, like a bad zone does.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, "julian-ish");
    });
  });

  describe("the document it stores as", () => {
    it("survives a JSON round trip", () => {
      // Given a rule read on the Hebrew calendar.
      const written = inCalendar("hebrew", daysOfMonth(1));

      // When it is stored and read back.
      const stored = JSON.stringify(written);
      const restored = parseRule(JSON.parse(stored));

      // Then nothing has moved.
      assertIdentical(JSON.stringify(restored), stored);
      assertIdentical(
        stored,
        '{"type":"inCalendar","calendar":"hebrew",' +
          '"rule":{"type":"daysOfMonth","days":[1]}}',
      );
    });

    it("refuses a stored calendar the runtime does not know", () => {
      // Given a document naming an invented calendar.
      const error = assertThrowsError(() =>
        parseRule({
          type: "inCalendar",
          calendar: 7,
          rule: { type: "always" },
        }),
      );

      // Then the message names the field.
      assertStringIncludes(error.message, "rule.calendar");
    });

    it("canonicalises the rule inside it", () => {
      // Given a wrapper holding an `all` that reduces to one operand.
      const written = inCalendar("hebrew", {
        type: "all",
        rules: [daysOfMonth(1)],
      });

      // When it is canonicalised.
      // Then the wrapper stays and its rule is reduced.
      assertIdentical(
        JSON.stringify(canonical(written)),
        '{"type":"inCalendar","calendar":"hebrew",' +
          '"rule":{"type":"daysOfMonth","days":[1]}}',
      );
    });

    it("cannot be written as cron, and says why", () => {
      // Given a rule read on another calendar.
      const written = toCron(inCalendar("hebrew", daysOfMonth(1)));

      // When it is written as cron.
      // Then it is refused. Both notations count Gregorian months and years.
      assertFalse(written.ok);
      assertStringIncludes(written.reason, "hebrew calendar");
    });

    it("says which calendar it counted on when it explains itself", () => {
      // Given Rosh Chodesh explained at one of its instants.
      const explanation = explainRule(
        inCalendar("hebrew", daysOfMonth(1)),
        when("2026-01-19T10:00", JERUSALEM),
      );

      // Then the account names the calendar, the way it names a zone.
      assertTrue(explanation.matched);
      assertStringIncludes(explanation.description, "hebrew calendar");
    });
  });
});
