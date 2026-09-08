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
  all,
  any,
  daysOfWeek,
  dates,
  monthsOfYear,
  timeOfDay,
  weekdays,
} from "./build.js";
import { equals } from "./canonical.js";
import { activeAt } from "./query.js";
import { schedule } from "./schedule.js";
import { parseTerms } from "./terms.js";

describe("reading a rule from a line of terms", () => {
  /** The rule a line comes to, as its stored form. */
  const read = (line: string): string => JSON.stringify(parseTerms(line));

  describe("terms add up", () => {
    it("narrows once for every term, whatever order they are in", () => {
      // Given office hours written two ways round.
      // When both are read.
      // Then they are the same rule. Each term says one more thing that has to
      // hold, and saying them in another order says the same.
      assertTrue(
        equals(
          parseTerms("mon-fri 09:00-17:00"),
          parseTerms("09:00-17:00 mon-fri"),
        ),
      );
    });

    it("means what the builders mean", () => {
      // Given a line and the same rule built by hand.
      // When they are compared.
      // Then the notation is a way of writing the builders and nothing else.
      const built = all(weekdays(), timeOfDay("09:00", "17:00"));
      assertTrue(equals(parseTerms("mon-fri 09:00-17:00"), built));
    });

    it("reads one term as that rule alone", () => {
      // Given a line of one term.
      // When it is read.
      // Then no `all` is wrapped around it, because there is nothing to meet.
      assertIdentical(
        read("weekends"),
        '{"type":"daysOfWeek","days":["saturday","sunday"]}',
      );
    });

    it("ignores the space between terms", () => {
      // Given a line padded and split with runs of whitespace.
      // When it is read.
      // Then it is the line without them. Whitespace separates terms and
      // carries nothing of its own, the way a shell reads a command.
      assertTrue(
        equals(
          parseTerms("  weekdays\t09:00-17:00 "),
          parseTerms("weekdays 09:00-17:00"),
        ),
      );
    });
  });

  describe("a line composes with the builders", () => {
    it("carries the fluent methods a built rule has", () => {
      // Given a line and a rule to widen it with.
      const week = parseTerms("mon-fri 09:00-17:00").or(
        parseTerms("sat 10:00-14:00"),
      );

      // When a Saturday lunchtime is asked about.
      // Then both halves hold. A line comes back built, the way `parseRule`
      // and `parseCron` hand theirs back, so the two ways of writing a rule
      // mix in one expression.
      assertTrue(activeAt(week, when("2026-03-14T12:00")));
      assertTrue(activeAt(week, when("2026-03-10T12:00")));
      assertFalse(activeAt(week, when("2026-03-14T16:00")));
    });
  });

  describe("a comma unions inside one term", () => {
    it("names several weekdays", () => {
      // Given two days in one term.
      // When it is read.
      // Then it covers either of them. Two terms would ask for days that were
      // both, and no day is.
      assertTrue(
        equals(parseTerms("sat,sun"), daysOfWeek("saturday", "sunday")),
      );
    });

    it("names a run of days, wrapping around the week", () => {
      // Given a range written from Friday to Monday.
      // When it is read.
      // Then it wraps through the weekend rather than being refused for
      // running backwards.
      assertIdentical(
        read("fri-mon"),
        '{"type":"daysOfWeek","days":["monday","friday","saturday","sunday"]}',
      );
    });

    it("names two windows in a day", () => {
      // Given a morning and an afternoon, with lunch between them.
      const opening = parseTerms("09:00-12:00,14:00-17:00");

      // When it is compared with the same pair built by hand.
      // Then the comma unioned them. This is the term the notation would be
      // unusable without, since two time terms would intersect to the overlap.
      const built = any(
        timeOfDay("09:00", "12:00"),
        timeOfDay("14:00", "17:00"),
      );
      assertTrue(equals(opening, built));
    });

    it("counts a day named twice only once", () => {
      // Given a range and a day already inside it.
      // When it is read.
      // Then the day appears once, in the order the week runs.
      assertIdentical(
        read("mon-wed,tue"),
        '{"type":"daysOfWeek","days":["monday","tuesday","wednesday"]}',
      );
    });
  });

  describe("the forms a term can be written in", () => {
    it("takes a weekday in full, short, or shouted", () => {
      // Given one day written three ways.
      // When each is read.
      // Then they agree. A line is usually typed by a person, and the case it
      // is typed in says nothing.
      const monday = daysOfWeek("monday");
      for (const written of ["monday", "mon", "MON", "Monday"]) {
        assertTrue(equals(parseTerms(written), monday));
      }
    });

    it("takes an hour without its leading zero", () => {
      // Given a time written the way it is said.
      // When it is read.
      // Then the zero is put back, because `Temporal` wants one and the
      // person writing the line does not.
      assertTrue(equals(parseTerms("9:00-17:00"), timeOfDay("09:00", "17:00")));
    });

    it("takes months by name", () => {
      // Given a run of months.
      // When it is read.
      // Then it is the months between, and no weekday was in the way. No
      // month shares its first three letters with a weekday.
      const built = monthsOfYear("june", "july", "august");
      assertTrue(equals(parseTerms("jun-aug"), built));
    });

    it("takes particular dates", () => {
      // Given two dates in one term.
      // When it is read.
      // Then both are named.
      const built = dates("2026-06-15", "2026-12-25");
      assertTrue(equals(parseTerms("2026-06-15,2026-12-25"), built));
    });

    it("takes a stretch between dates, open at either end", () => {
      // Given a range and two half-open ones.
      // When each is read.
      // Then `..` is what separates them. A date already holds two dashes, so
      // `2026-01-01-2026-12-31` would read as neither one date nor two.
      assertIdentical(
        read("2026-01-01..2026-12-31"),
        '{"type":"dateRange","from":"2026-01-01","to":"2026-12-31"}',
      );
      assertIdentical(
        read("2026-06-01.."),
        '{"type":"dateRange","from":"2026-06-01"}',
      );
      assertIdentical(
        read("..2026-06-01"),
        '{"type":"dateRange","to":"2026-06-01"}',
      );
    });
  });

  describe("qualifiers say what a shape cannot", () => {
    it("names days of the month, counting from either end", () => {
      // Given the first, the fifteenth and the last.
      // When the term is read.
      // Then a bare `1,15,-1` would have had to mean this or three times of
      // day, so the qualifier is what settles it.
      assertIdentical(
        read("day:1,15,-1"),
        '{"type":"daysOfMonth","days":[1,15,-1]}',
      );
    });

    it("names a weekday by its place in the month", () => {
      // Given the last Friday.
      // When the term is read.
      // Then the count comes first, the way it is said.
      assertIdentical(
        read("nth:-1,fri"),
        '{"type":"nthDayOfWeekInMonth","nth":-1,"days":["friday"]}',
      );
    });

    it("names a cycle, with the date it lands on", () => {
      // Given a fortnight anchored on a Monday.
      // When the term is read.
      // Then the anchor is part of the term. Every other term means the same
      // wherever it is read, and a cycle with an implied anchor would name
      // different weeks depending on when the line was read.
      assertIdentical(
        read("every:2w@2026-01-05"),
        '{"type":"every","interval":2,"period":"weeks","anchor":"2026-01-05"}',
      );
    });

    it("names months by number, for a line a program wrote", () => {
      // Given months as numbers rather than names.
      // When the term is read.
      // Then it is the same rule `jun-aug` would have been. A name is easier
      // to read and a number is easier to generate, so both are taken.
      const built = monthsOfYear("march", "june");
      assertTrue(equals(parseTerms("month:3,6"), built));
    });

    it("names a custom rule and hands it its options", () => {
      // Given a rule whose meaning lives in code.
      // When the term is read.
      // Then the document holds the name and the options, and nothing else.
      // Evaluating it still needs the registry.
      assertIdentical(
        read("holidays:gb"),
        '{"type":"custom","name":"holidays","options":"gb"}',
      );
    });

    it("excludes whatever term follows it", () => {
      // Given weekdays with a date cut out.
      const rule = parseTerms("weekdays except:2026-12-25");

      // When Christmas and the day after are asked about.
      // Then the exception applies. Both are weekdays in 2026.
      assertFalse(activeAt(rule, when("2026-12-25T10:00")));
      assertTrue(activeAt(rule, when("2026-12-24T10:00")));
    });
  });

  describe("the scope the whole line is read in", () => {
    it("reads the line in a named zone", () => {
      // Given office hours in London, asked about from a Tokyo clock.
      const rule = parseTerms("mon-fri 09:00-17:00 @Europe/London");

      // When ten in the morning in Tokyo is asked about, which is one in the
      // morning in London.
      // Then it is closed. The zone wraps the whole line rather than the term
      // it was written next to.
      assertFalse(activeAt(rule, when("2026-03-10T10:00", "Asia/Tokyo")));
      assertTrue(activeAt(rule, when("2026-03-10T18:00", "Asia/Tokyo")));
    });

    it("reads the line on a named calendar", () => {
      // Given the first month of the year, read on the Hebrew calendar.
      // When the line is read.
      // Then the calendar wraps the line, so the code inside is Tishri rather
      // than January.
      assertIdentical(
        read("cal:hebrew M01"),
        '{"type":"inCalendar","calendar":"hebrew",' +
          '"rule":{"type":"monthCodes","codes":["M01"]}}',
      );
    });

    it("refuses a line that names two zones", () => {
      // Given a line with a zone written twice.
      const error = assertThrowsError(() =>
        parseTerms("weekdays @Europe/London @Asia/Tokyo"),
      );

      // Then it is refused. A line is one rule on one clock, and picking
      // either zone would be a guess about which was meant.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, "Europe/London");
      assertStringIncludes(error.message, "Asia/Tokyo");
    });
  });

  describe("what it refuses, and what it says", () => {
    it("refuses a term it cannot read rather than passing over it", () => {
      // Given a line with a word that is not a term.
      const error = assertThrowsError(() => parseTerms("weekdays sometimes"));

      // Then it is refused, and the term is named. Reading the line and
      // dropping the term would give a rule that runs and covers the wrong
      // time, and nothing would say so.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, '"sometimes"');
    });

    it("says where in the line the term was", () => {
      // Given a line whose third term is the problem.
      const error = assertThrowsError(() =>
        parseTerms("weekdays 09:00-17:00 sometimes"),
      );

      // Then the position is in the message, because the term itself may
      // appear more than once.
      assertStringIncludes(error.message, "Term 3");
    });

    it("suggests the word a misspelt one was near", () => {
      // Given a weekday with a letter missing.
      const error = assertThrowsError(() => parseTerms("weekdys"));

      // Then it says what was probably meant.
      assertStringIncludes(error.message, 'Did you mean "weekdays"');
    });

    it("suggests the qualifier a misspelt one was near", () => {
      // Given the exception qualifier, misspelt.
      const error = assertThrowsError(() =>
        parseTerms("weekdays excpet:2026-12-25"),
      );

      // Then it is caught here rather than becoming a custom rule named
      // "excpet", which would fail later and somewhere else.
      assertStringIncludes(error.message, 'Did you mean "except:"');
    });

    it("refuses a broken time range rather than reading it as a rule", () => {
      // Given a range whose second half is not a time.
      const error = assertThrowsError(() => parseTerms("09:00-half"));

      // Then it is refused. A term holding a colon is usually a qualifier,
      // and a custom rule named "09" would be a worse answer than none.
      assertStringIncludes(error.message, 'cannot read "09:00-half"');
    });

    it("refuses a line that names two calendars", () => {
      // Given a line with a calendar written twice.
      const error = assertThrowsError(() =>
        parseTerms("M01 cal:hebrew cal:islamic"),
      );

      // Then it is refused for the same reason two zones are. A line counts
      // on one calendar.
      assertStringIncludes(error.message, "hebrew");
      assertStringIncludes(error.message, "islamic");
    });

    it("refuses a range whose far end is not a day", () => {
      // Given a range opening on a weekday and closing on nothing.
      const error = assertThrowsError(() => parseTerms("mon-someday"));

      // Then the whole term is refused. Reading the half it understood would
      // be a rule covering Mondays and saying nothing about the rest.
      assertStringIncludes(error.message, '"mon-someday"');
    });

    it("refuses a range with more than two ends", () => {
      // Given three days joined by dashes.
      const error = assertThrowsError(() => parseTerms("mon-wed-fri"));

      // Then it is refused. A range runs between two days, and a list of
      // three is written with commas.
      assertStringIncludes(error.message, '"mon-wed-fri"');
    });

    it("refuses a stretch whose ends are not dates", () => {
      // Given `..` with something other than a date on either side.
      for (const line of ["soon..2026-01-01", "2026-01-01..soon", ".."]) {
        const error = assertThrowsError(() => parseTerms(line));
        assertStringIncludes(error.message, "cannot read");
      }
    });

    it("refuses a cycle counted in nothing", () => {
      // Given a count with no unit after it.
      const error = assertThrowsError(() => parseTerms("every:2@2026-01-05"));

      // Then it is refused, with the units it takes.
      assertStringIncludes(error.message, "d, w, mo or y");
    });

    it("refuses a month outside the year", () => {
      // Given a thirteenth month on the Gregorian calendar.
      const error = assertThrowsError(() => parseTerms("month:13"));

      // Then it is refused, naming the range it wanted.
      assertStringIncludes(error.message, "1 to 12");
    });

    it("refuses a count that is not a whole number", () => {
      // Given a place in the month written as a word.
      const error = assertThrowsError(() => parseTerms("nth:first,monday"));

      // Then it is refused, with the form that would have worked.
      assertStringIncludes(error.message, "nth:-1,friday");
    });

    it("refuses a place in the month with no weekday after it", () => {
      // Given a count followed by something that is not a day.
      const error = assertThrowsError(() => parseTerms("nth:1,someday"));

      // Then it is refused.
      assertStringIncludes(error.message, "names no weekday");
    });

    it("refuses a day of the month that is not a number", () => {
      // Given a day written as a word.
      const error = assertThrowsError(() => parseTerms("day:first"));

      // Then it is refused, with the form that would have worked.
      assertStringIncludes(error.message, "day:1,15,-1");
    });

    it("refuses an exception that excludes a scope rather than a rule", () => {
      // Given a zone written where a rule was wanted.
      const error = assertThrowsError(() =>
        parseTerms("weekdays except:@Europe/London"),
      );

      // Then it is refused. A zone says how the line is read rather than what
      // it covers, and there is nothing in it to take away.
      assertStringIncludes(error.message, "covers no time");
    });

    it("refuses a bare number, which could be either of two things", () => {
      // Given a number on its own.
      const error = assertThrowsError(() => parseTerms("15"));

      // Then it is refused rather than guessed at. It reads as the fifteenth
      // of the month or as three in the afternoon, and neither is offered.
      assertStringIncludes(error.message, '"15"');
    });

    it("refuses a cycle with no anchor, and says what one looks like", () => {
      // Given a fortnight with nothing to fix its phase.
      const error = assertThrowsError(() => parseTerms("every:2w"));

      // Then it is refused, with the form that would have worked.
      assertStringIncludes(error.message, "every:2w@2026-01-05");
    });

    it("refuses `m` as a period, because it reads two ways", () => {
      // Given a cycle counted in `m`.
      const error = assertThrowsError(() => parseTerms("every:2m@2026-01-05"));

      // Then it is refused. Elsewhere `m` is minutes as often as months, and
      // guessing wrong here is a rule that fires thirty times too often.
      assertStringIncludes(error.message, "mo");
    });

    it("refuses an empty line", () => {
      // Given nothing to read.
      const error = assertThrowsError(() => parseTerms("   "));

      // Then it is refused with an example, rather than covering all of time.
      assertStringIncludes(error.message, "at least one term");
    });
  });

  describe("a line of nothing but scope", () => {
    it("covers all of time, on the clock it names", () => {
      // Given a line that narrows nothing and only says where it is read.
      const rule = parseTerms("@Europe/London");

      // When any instant is asked about.
      // Then it is covered. No term narrowed it, and a conjunction of nothing
      // is everything, the way `all()` is.
      assertTrue(activeAt(rule, when("2026-03-10T03:00")));
    });
  });

  describe("what a schedule does with a line", () => {
    it("takes one as a scope", () => {
      // Given opening hours written as one string.
      const office = schedule({ zone: "Europe/London" }).open(
        "mon-fri 09:00-17:00",
      );

      // When a Tuesday and a Sunday lunchtime are asked about.
      // Then both terms narrowed it.
      assertTrue(office.isOpen(when("2026-03-10T12:00")));
      assertFalse(office.isOpen(when("2026-03-15T12:00")));
    });

    it("holds the week in layers rather than in one line", () => {
      // Given a week with different hours at the weekend.
      const shop = schedule({ zone: "Europe/London" })
        .open("mon-fri 09:00-17:00")
        .open("sat 10:00-14:00");

      // When each is asked about.
      // Then both hold. A line is one conjunction, and the cascade is what
      // says "or", which is why the notation needs no separator of its own.
      assertTrue(shop.isOpen(when("2026-03-10T12:00")));
      assertTrue(shop.isOpen(when("2026-03-14T12:00")));
      assertFalse(shop.isOpen(when("2026-03-14T16:00")));
    });
  });
});
