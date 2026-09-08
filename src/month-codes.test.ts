import { when } from "#test/intervals.js";
import {
  assertArrayEmpty,
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { inCalendar, monthCodes, monthsOfYear } from "./build.js";
import type { MonthCode } from "./rule.js";
import { canonical, equals } from "./canonical.js";
import type { Context } from "./context.js";
import { toCron } from "./cron-export.js";
import { intervals } from "./interpret.js";
import { parseRule } from "./parse.js";
import { activeAt } from "./query.js";
import { explainRule } from "./rule-explanation.js";
import { toRRule } from "./rrule-export.js";

describe("naming a month by its code", () => {
  const JERUSALEM = "Asia/Jerusalem";

  const between = (from: string, to: string): Context => ({
    from: Temporal.ZonedDateTime.from(`${from}T00:00[${JERUSALEM}]`),
    to: Temporal.ZonedDateTime.from(`${to}T00:00[${JERUSALEM}]`),
  });

  /** The ISO date an interval runs from, or to, as a bare date. */
  const date = (at: Temporal.ZonedDateTime | undefined): string =>
    at?.toPlainDate().toString() ?? "*";

  /** The ISO dates each interval runs from and up to, as one readable line. */
  const spans = (
    rule: Parameters<typeof intervals>[0],
    context: Context,
  ): string =>
    [...intervals(rule, context)]
      .map((interval) => `${date(interval.start)}..${date(interval.end)}`)
      .join(" ");

  describe("what a code selects", () => {
    it("covers the whole of the month the code names", () => {
      // Given the third month of the year, on the ISO calendar.
      // When a stretch of 2026 is evaluated.
      // Then March comes back whole, as one interval.
      assertIdentical(
        spans(monthCodes("M03"), between("2026-01-01", "2026-06-01")),
        "2026-03-01..2026-04-01",
      );
    });

    it("means the same days as the Gregorian name on the ISO calendar", () => {
      // Given the same month written both ways.
      const window = between("2026-01-01", "2027-01-01");

      // When both are evaluated.
      // Then the codes are the Gregorian months in order, so the two agree.
      assertIdentical(
        spans(monthCodes("M03"), window),
        spans(monthsOfYear("march"), window),
      );
    });

    it("means a different month on a different calendar", () => {
      // Given the first month of the year, read on the Hebrew calendar.
      const tishri = inCalendar("hebrew", monthCodes("M01"));

      // When a stretch spanning a Hebrew new year is evaluated.
      // Then it covers Tishri. The document is the same one that gives January
      // on the ISO calendar, and only the calendar it counts on differs.
      assertIdentical(
        spans(tishri, between("2026-06-01", "2027-01-01")),
        "2026-09-12..2026-10-12",
      );
    });

    it("selects a leap month the calendar has no other name for", () => {
      // Given Adar I, which exists only in a Hebrew leap year.
      const adarI = inCalendar("hebrew", monthCodes("M05L"));

      // When two Hebrew years are evaluated. 5784 is a leap year and 5785 is
      // not.
      // Then the leap month comes back once. This is what no Gregorian month
      // name can say: in a leap year the month numbered 6 is Adar I, and in a
      // common year it is Adar.
      assertIdentical(
        spans(adarI, between("2023-09-01", "2025-09-01")),
        "2024-02-10..2024-03-11",
      );
    });

    it("covers no time where the calendar never reaches the code", () => {
      // Given a leap month, with no calendar named.
      const rule = monthCodes("M05L");

      // When a whole ISO year is evaluated.
      // Then nothing comes back. The ISO calendar has no leap month, the way
      // February has no 31st, and a code it never reaches selects no days
      // rather than failing.
      assertArrayEmpty([
        ...intervals(rule, between("2026-01-01", "2027-01-01")),
      ]);
    });

    it("covers no time when no codes are named", () => {
      // Given a rule listing nothing.
      // When a year is evaluated.
      // Then it covers no time, the way an empty `monthsOfYear` does.
      assertArrayEmpty([
        ...intervals(monthCodes(), between("2026-01-01", "2027-01-01")),
      ]);
    });

    it("answers a point query on the calendar in force", () => {
      // Given Adar I, and an instant inside it.
      const adarI = inCalendar("hebrew", monthCodes("M05L"));
      const inAdarI = when("2024-02-25T10:00", JERUSALEM);

      // When the same instant is checked with and without the calendar.
      // Then the calendar decides. Read as ISO the instant is in M02.
      assertTrue(activeAt(adarI, inAdarI));
      assertFalse(activeAt(monthCodes("M05L"), inAdarI));
    });
  });

  describe("what it refuses to be written as", () => {
    it("refuses a code that got past the type", () => {
      // Given a month written the way a person would write it, arriving as a
      // plain string. TypeScript refuses this call without the cast, and a
      // value read from a database or a form arrives with no such gate.
      const error = assertThrowsError(() =>
        monthCodes("M01", "March" as MonthCode),
      );

      // Then it is refused where it is written, the message names the index,
      // and it gives the form rather than listing twenty-six codes.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, "codes[1]");
      assertStringIncludes(error.message, '"M01"');
    });

    it("refuses a month number", () => {
      // Given a month written as `Temporal` numbers one.
      const error = assertThrowsError(() => monthCodes("3" as MonthCode));

      // Then it is refused. A code is not a number, and reading one as the
      // other is the off-by-one that naming a month avoids.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, '"3"');
    });

    it("refuses a bad code in a stored document, and says where", () => {
      // Given a document holding a code that will not read.
      const error = assertThrowsError(() =>
        parseRule({ type: "monthCodes", codes: ["M01", "M14"] }),
      );

      // Then the complaint names the field and the index.
      assertStringIncludes(error.message, "rule.codes[1]");
    });

    it("cannot be written as cron, and says why", () => {
      // Given a month named by code.
      const written = toCron(monthCodes("M03"));

      // When it is written as cron.
      // Then it is refused, and the reason points at the rule that can be. On
      // the ISO calendar the two select the same days, and the document does
      // not say which calendar reads it.
      assertFalse(written.ok);
      assertStringIncludes(written.reason, "cron's month field is Gregorian");
      assertStringIncludes(written.reason, "monthsOfYear");
    });

    it("cannot be written as a recurrence either", () => {
      // Given the same rule written as an RRULE.
      const written = toRRule(monthCodes("M03"));

      // Then BYMONTH refuses it for the same reason.
      assertFalse(written.ok);
      assertStringIncludes(written.reason, "BYMONTH is Gregorian");
    });
  });

  describe("the document it stores as", () => {
    it("survives a JSON round trip", () => {
      // Given Adar I read on the Hebrew calendar.
      const written = inCalendar("hebrew", monthCodes("M05L"));

      // When it is stored and read back.
      const stored = JSON.stringify(written);
      const restored = parseRule(JSON.parse(stored));

      // Then nothing has moved.
      assertIdentical(JSON.stringify(restored), stored);
      assertIdentical(
        stored,
        '{"type":"inCalendar","calendar":"hebrew",' +
          '"rule":{"type":"monthCodes","codes":["M05L"]}}',
      );
    });

    it("writes its codes in calendar order, once each", () => {
      // Given codes in the order someone thought of them, with a repeat.
      const written = monthCodes("M06", "M05L", "M05", "M06");

      // When it is canonicalised.
      // Then the codes read up the year, with the leap month straight after
      // the month it follows. Zero-padded digits sort that way on their own.
      assertIdentical(
        JSON.stringify(canonical(written)),
        '{"type":"monthCodes","codes":["M05","M05L","M06"]}',
      );
    });

    it("compares equal to the same months written another way round", () => {
      // Given one selection written twice.
      // When the two are compared.
      // Then they are the same rule.
      assertTrue(equals(monthCodes("M01", "M02"), monthCodes("M02", "M01")));
    });

    it("stays a different rule from the Gregorian name", () => {
      // Given March written as a name and as a code.
      // When they are compared.
      // Then they differ. The two cover the same days on the ISO calendar and
      // different days under a wrapper, so the syntactic form keeps them
      // apart.
      assertFalse(equals(monthCodes("M03"), monthsOfYear("march")));
    });
  });

  describe("the account it gives", () => {
    it("names the code the instant falls in", () => {
      // Given four months, and an instant in none of them.
      const rule = monthCodes("M06", "M07", "M08", "M09");

      // When a February instant is explained.
      const explanation = explainRule(rule, when("2026-02-14T10:00"));

      // Then the account says which month the instant is in and how many were
      // listed.
      assertFalse(explanation.matched);
      assertIdentical(
        explanation.description,
        "Month M02 is not one of 4 listed month codes.",
      );
    });

    it("reads the code on the calendar around it", () => {
      // Given Adar I on the Hebrew calendar.
      const rule = inCalendar("hebrew", monthCodes("M05L"));

      // When an instant inside it is explained.
      const explanation = explainRule(
        rule,
        when("2024-02-25T10:00", JERUSALEM),
      );

      // Then the account names the calendar and reports the match. The same
      // instant read as ISO is in M02.
      assertTrue(explanation.matched);
      assertIdentical(
        explanation.description,
        "The rule counts on the hebrew calendar. The month is M05L.",
      );
    });
  });
});
