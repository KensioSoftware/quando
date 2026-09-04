import { inWindow, render } from "#test/intervals.js";
import {
  assertArrayLength,
  assertIdentical,
  assertStringIncludes,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  all,
  always,
  any,
  between,
  dates,
  daysOfMonth,
  daysOfWeek,
  every,
  inZone,
  monthsOfYear,
  never,
  nthDayOfWeekInMonth,
  not,
  onOrAfter,
  onOrBefore,
  timeOfDay,
  weekdays,
  weekends,
} from "./build.js";
import { intervals } from "./interpret.js";
import { parseRule } from "./parse.js";
import type { Month, Period, Rule, Weekday } from "./rule.js";

describe("the builder", () => {
  /** Monday 2026-03-09 to the Monday after it. */
  const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

  /** Keeps an assertion about the rule and off the plumbing. */
  const read = (rule: Rule, context = WEEK): string =>
    render(intervals(rule, context));

  describe("a built rule", () => {
    it("keeps methods out of its data properties", () => {
      // Given a fluent weekday rule.
      const rule = weekdays();

      // When ordinary data operations inspect and clone it.
      const keys = Object.keys(rule);
      const cloned = structuredClone(rule);

      // Then only rule data is present and the clone succeeds.
      assertIdentical(keys.join(" "), "type days");
      assertIdentical(JSON.stringify(cloned), JSON.stringify(rule));
    });

    it("restores fluent methods after parsing", () => {
      // Given a rule that has passed through JSON storage.
      const stored = structuredClone(weekdays());
      const parsed = parseRule(stored);

      // When the restored rule is extended with opening hours.
      const office = parsed.and(timeOfDay("09:00", "17:00"));

      // Then it retains the fluent API and covers the expected week.
      assertArrayLength(read(office).split(" "), 5);
    });

    it("is the document it stands for, with the methods left out", () => {
      // Given office hours built through the fluent form.
      const rule = weekdays().and(timeOfDay("09:00", "17:00"));

      // When it is serialised.
      // Then out comes the object literal it stands for. JSON.stringify drops
      // the methods, and that is the whole of the trick.
      assertIdentical(
        JSON.stringify(rule),
        JSON.stringify({
          type: "all",
          rules: [
            {
              type: "daysOfWeek",
              days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            },
            { type: "timeOfDay", from: "09:00", to: "17:00" },
          ],
        }),
      );
    });

    it("keeps its literal type through the builder", () => {
      // Given the same rule.
      const rule = weekdays().and(timeOfDay("09:00", "17:00"));

      // When its type tag is read.
      // Then it is the literal `"all"` and not `string`, so an interpreter can
      // narrow on it. The annotation is the assertion.
      const type: "all" = rule.type;

      assertIdentical(type, "all");
    });

    it("satisfies Rule without being converted out of anything", () => {
      // Given a built rule assigned straight to the plain type.
      // When its tag is read.
      // Then it holds, with no build step in between.
      const rule: Rule = weekends();

      assertIdentical(rule.type, "daysOfWeek");
    });

    it("survives a round trip through JSON unchanged", () => {
      // Given a built rule, stored and read back through the parser.
      const built = weekdays().and(timeOfDay("09:00", "17:00"));
      const stored = JSON.stringify(built);
      const parsed = parseRule(JSON.parse(stored));

      // When both are read over the same week.
      // Then they cover the same time. Storing a rule loses nothing.
      assertIdentical(read(parsed), read(built));
    });
  });

  describe("combining", () => {
    it("refuses invalid authoring inputs immediately", () => {
      // Given malformed times, equal endpoints, dates, and zones.
      // When each is passed to a builder.
      // Then each fails before a query starts.
      assertThrowsError(() => timeOfDay("breakfast", "17:00"));
      assertThrowsError(() => timeOfDay("09:00", "09:00"));
      assertThrowsError(() => dates("Christmas"));
      assertThrowsError(() => daysOfWeek("monday", "funday" as Weekday));
      assertThrowsError(() => inZone("Mars/Olympus", weekdays()));
    });

    it("refuses a day the month can never have", () => {
      // Given days outside the month, either way round, and the zero a caller
      // writes when they have an off-by-one.
      // When each is passed to the builder.
      // Then each fails where it is written rather than covering nothing later.
      assertThrowsError(() => daysOfMonth(32));
      assertThrowsError(() => daysOfMonth(0));
      assertThrowsError(() => daysOfMonth(-32));
      assertThrowsError(() => daysOfMonth(1.5));
    });

    it("refuses an occurrence no month can hold", () => {
      // Given a sixth occurrence, which no month has of any weekday, and the
      // zero a caller writes when they have an off-by-one.
      // When each is passed to the builder.
      // Then each fails where it is written.
      assertThrowsError(() => nthDayOfWeekInMonth(6, "monday"));
      assertThrowsError(() => nthDayOfWeekInMonth(0, "monday"));
      assertThrowsError(() => nthDayOfWeekInMonth(-6, "monday"));
    });

    it("refuses a range that ends before it starts", () => {
      // Given two dates the wrong way round, and a date that is not one.
      // When each is passed to a builder.
      // Then each fails where it is written. A backwards range covers no time
      // and almost always means the arguments were swapped.
      assertThrowsError(() => between("2026-04-30", "2026-04-01"));
      assertThrowsError(() => onOrAfter("Christmas"));
      assertThrowsError(() => onOrBefore("2026-13-45"));
    });

    it("refuses an interval or period that is not one", () => {
      // Given a zero interval, a fractional one, and a period spelled
      // singular. Periods are plural because they follow a count.
      // When each is passed to the builder.
      // Then each fails where it is written.
      const anchor = { anchor: "2026-03-09" };
      assertThrowsError(() => every(0, "weeks", anchor));
      assertThrowsError(() => every(1.5, "weeks", anchor));
      assertThrowsError(() => every(-2, "weeks", anchor));
      assertThrowsError(() => every(2, "week" as Period, anchor));
      assertThrowsError(() => every(2, "weeks", { anchor: "Christmas" }));
    });

    it("runs a fortnightly meeting from an anchor and a weekday", () => {
      // Given the fortnightly cycle a real meeting is written as.
      const meeting = every(2, "weeks", { anchor: "2026-03-09" }).and(
        daysOfWeek("monday"),
      );
      const month = inWindow("2026-03-09T00:00", "2026-04-13T00:00");

      // When five weeks are read.
      // Then the meeting lands every other Monday.
      assertIdentical(
        read(meeting, month),
        "[2026-03-09T00:00:00,2026-03-10T00:00:00) " +
          "[2026-03-23T00:00:00,2026-03-24T00:00:00) " +
          "[2026-04-06T00:00:00,2026-04-07T00:00:00)",
      );
    });

    it("bounds a cycle with a date, because the anchor does not", () => {
      // Given the same fortnightly meeting, starting in April. The anchor sets
      // the phase and covers time before it, so a start date is a separate
      // rule and the two compose.
      const meeting = every(2, "weeks", { anchor: "2026-03-09" })
        .and(daysOfWeek("monday"))
        .and(onOrAfter("2026-03-23"));
      const month = inWindow("2026-03-09T00:00", "2026-04-13T00:00");

      // When five weeks are read.
      // Then the first meeting is the one on or after the start date.
      assertIdentical(
        read(meeting, month),
        "[2026-03-23T00:00:00,2026-03-24T00:00:00) " +
          "[2026-04-06T00:00:00,2026-04-07T00:00:00)",
      );
    });

    it("takes a zone for the cycle", () => {
      // Given a fortnightly cycle in Tokyo, read from a London context over a
      // window that opens before Tokyo's cycle does. Tokyo is nine hours
      // ahead, so its 9 March starts on London's 8th.
      const days = inWindow("2026-03-08T00:00", "2026-03-10T00:00");

      // When it is read.
      // Then the cycle turns over on Tokyo's midnight rather than London's.
      assertIdentical(
        read(
          every(2, "weeks", { anchor: "2026-03-09", zone: "Asia/Tokyo" }),
          days,
        ),
        "[2026-03-08T15:00:00,2026-03-10T00:00:00)",
      );
    });

    it("takes a range of one day", () => {
      // Given the same date at both ends, which a generated range can produce.
      // When one day is read.
      // Then it covers that whole day rather than nothing.
      const april = inWindow("2026-04-01T00:00", "2026-05-01T00:00");
      assertIdentical(
        read(between("2026-04-10", "2026-04-10"), april),
        "[2026-04-10T00:00:00,2026-04-11T00:00:00)",
      );
    });

    it("takes a zone for the range, so a date means a day there", () => {
      // Given one day in Tokyo, read from a London context. Tokyo is nine
      // hours ahead, so its day opens while London is still on the evening
      // before.
      const april = inWindow("2026-04-01T00:00", "2026-04-03T00:00");

      // When it is read.
      // Then the interval is Tokyo's day on London's clock.
      assertIdentical(
        read(between("2026-04-01", "2026-04-01", "Asia/Tokyo"), april),
        "[2026-04-01T00:00:00,2026-04-01T16:00:00)",
      );
    });

    it("takes a zone on a one-sided bound too", () => {
      // Given a start and an end in Tokyo, which is nine hours ahead. Both
      // one-sided builders take a zone the way `between` does.
      const twoDays = inWindow("2026-04-01T00:00", "2026-04-03T00:00");

      // When each is read from a London context.
      // Then each turns over on Tokyo's midnight rather than London's.
      assertIdentical(
        read(onOrAfter("2026-04-02", "Asia/Tokyo"), twoDays),
        "[2026-04-01T16:00:00,2026-04-03T00:00:00)",
      );
      assertIdentical(
        read(onOrBefore("2026-04-01", "Asia/Tokyo"), twoDays),
        "[2026-04-01T00:00:00,2026-04-01T16:00:00)",
      );
    });

    it("bounds opening hours to a season", () => {
      // Given weekend hours that only run over the summer, which is the shape
      // this rule exists for.
      const summerOnly = weekends().and(between("2026-06-01", "2026-08-31"));
      const may = inWindow("2026-05-01T00:00", "2026-06-01T00:00");
      const june = inWindow("2026-06-01T00:00", "2026-06-15T00:00");

      // When each month is read.
      // Then May covers nothing and June covers its weekends.
      assertIdentical(read(summerOnly, may), "");
      assertIdentical(
        read(summerOnly, june),
        "[2026-06-06T00:00:00,2026-06-08T00:00:00) " +
          "[2026-06-13T00:00:00,2026-06-15T00:00:00)",
      );
    });

    it("refuses a month that is not one", () => {
      // Given a misspelled month name.
      // When it is passed to the builder.
      // Then it fails immediately, the way a misspelled weekday does.
      assertThrowsError(() => monthsOfYear("august", "octobre" as Month));
    });

    it("intersects a day of the month with a month", () => {
      // Given the last working day pattern people write for quarter ends: the
      // final day of March.
      const quarterEnd = monthsOfYear("march").and(daysOfMonth(-1));

      // When the first quarter of 2026 is read.
      const quarter = inWindow("2026-01-01T00:00", "2026-04-01T00:00");

      // Then only 31 March comes back.
      assertIdentical(
        read(quarterEnd, quarter),
        "[2026-03-31T00:00:00,2026-04-01T00:00:00)",
      );
    });

    it("ands", () => {
      // Given weekdays intersected with office hours.
      // When the week is read.
      const days = read(weekdays().and(timeOfDay("09:00", "17:00"))).split(" ");

      // Then five working days come back, one per weekday.
      assertArrayLength(days, 5);
    });

    it("ors", () => {
      // Given the weekend and one midweek day.
      const midweek = dates("2026-03-11");

      // When the union is read.
      // Then the Wednesday and the weekend both appear, apart from each other.
      assertIdentical(
        read(weekends().or(midweek)),
        "[2026-03-11T00:00:00,2026-03-12T00:00:00) " +
          "[2026-03-14T00:00:00,2026-03-16T00:00:00)",
      );
    });

    it("excepts, which is the shape a schedule with holidays actually has", () => {
      // Given office hours with one day taken out of them.
      const open = weekdays()
        .and(timeOfDay("09:00", "17:00"))
        .except(dates("2026-03-11"));

      // When the week is read.
      // Then four days remain and the Wednesday is gone entirely.
      assertIdentical(
        read(open),
        "[2026-03-09T09:00:00,2026-03-09T17:00:00) " +
          "[2026-03-10T09:00:00,2026-03-10T17:00:00) " +
          "[2026-03-12T09:00:00,2026-03-12T17:00:00) " +
          "[2026-03-13T09:00:00,2026-03-13T17:00:00)",
      );
    });

    it("excepts nothing when given nothing to except", () => {
      // Given a weekend rule and an exception list that came out empty.
      // When it is read.
      // Then the weekend is untouched, which is what makes building from a
      // filtered list safe.
      assertIdentical(
        read(weekends().except()),
        "[2026-03-14T00:00:00,2026-03-16T00:00:00)",
      );
    });

    it("builds the identities", () => {
      // Given the four rules that cover everything or nothing.
      // When each is read over the week.
      // Then `always` and an empty `all` give the whole window, while `never`
      // and an empty `any` give none of it.
      assertIdentical(
        read(always()),
        "[2026-03-09T00:00:00,2026-03-16T00:00:00)",
      );
      assertIdentical(read(never()), "");
      assertIdentical(read(all()), "[2026-03-09T00:00:00,2026-03-16T00:00:00)");
      assertIdentical(read(any()), "");
    });

    it("negates", () => {
      // Given the weekend.
      // When its complement is read over the week.
      // Then the five weekdays come back as one stretch, clipped to the window.
      const weekdaysOnly = not(weekends());

      assertIdentical(
        read(weekdaysOnly),
        "[2026-03-09T00:00:00,2026-03-14T00:00:00)",
      );
    });

    it("names a zone for a leaf", () => {
      // Given London office hours, read from a Tokyo day. London is nine hours
      // behind in March.
      const tokyo = inWindow(
        "2026-03-09T00:00",
        "2026-03-10T00:00",
        "Asia/Tokyo",
      );
      const london = inZone("Europe/London", timeOfDay("09:00", "17:00"));

      // When the rule is serialised, and read over that day.
      // Then the zone is in the document, and the Tokyo day catches the tail of
      // one London working day and the head of the next.
      assertStringIncludes(JSON.stringify(london), '"zone":"Europe/London"');
      assertIdentical(
        read(london, tokyo),
        "[2026-03-09T00:00:00,2026-03-09T02:00:00) " +
          "[2026-03-09T18:00:00,2026-03-10T00:00:00)",
      );
    });

    it("takes a zone as an argument too", () => {
      // Given hours built with the zone passed in rather than added after.
      // When the rule is serialised.
      // Then the document is the same either way.
      assertIdentical(
        JSON.stringify(timeOfDay("09:00", "17:00", "Europe/London")),
        '{"type":"timeOfDay","from":"09:00","to":"17:00","zone":"Europe/London"}',
      );
    });

    it("leaves the zone out entirely when there is not one", () => {
      // Given hours built with no zone.
      // When the rule is serialised.
      // Then the field is absent. A present `undefined` would vanish through
      // JSON anyway, and would make two equivalent rules compare as different
      // documents on the way in.
      assertIdentical(
        JSON.stringify(timeOfDay("09:00", "17:00")),
        '{"type":"timeOfDay","from":"09:00","to":"17:00"}',
      );
    });

    it("nests without limit", () => {
      // Given two days unioned, narrowed to a morning window, with one of the
      // days then excepted out.
      const rule = daysOfWeek("monday")
        .or(daysOfWeek("wednesday"))
        .and(timeOfDay("09:00", "12:00"))
        .except(dates("2026-03-09"));

      // When it is read.
      // Then only the Wednesday morning survives all three steps.
      assertIdentical(read(rule), "[2026-03-11T09:00:00,2026-03-11T12:00:00)");
    });

    it("applies a zone to a whole subtree", () => {
      // Given London office hours grouped under one zone.
      const london = inZone(
        "Europe/London",
        weekdays().and(timeOfDay("09:00", "17:00")),
      );
      const tokyo = inWindow(
        "2026-03-09T00:00",
        "2026-03-10T00:00",
        "Asia/Tokyo",
      );

      // When a Tokyo day is read.
      const result = read(london, tokyo);

      // Then both leaves use London time.
      assertIdentical(result, "[2026-03-09T18:00:00,2026-03-10T00:00:00)");
    });
  });
});
