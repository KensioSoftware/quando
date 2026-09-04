import { when } from "#test/intervals.js";
import {
  assertArrayEquals,
  assertFalse,
  assertIdentical,
  assertStringIncludes,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  all,
  always,
  any,
  dates,
  daysOfMonth,
  daysOfWeek,
  inZone,
  monthsOfYear,
  never,
  not,
  timeOfDay,
  weekdays,
} from "./build.js";
import { explainRule } from "./rule-explanation.js";

describe("explaining why a rule matches", () => {
  it("describes each condition in a compound rule", () => {
    // Given ordinary weekday office hours with no caller-written description.
    const officeHours = all(weekdays(), timeOfDay("09:00", "17:00"));

    // When a Wednesday morning is explained.
    const explanation = explainRule(officeHours, when("2026-03-11T10:00"));

    // Then the result says what matched in calendar and clock terms.
    assertTrue(explanation.matched);
    assertIdentical(
      explanation.description,
      "Every condition matches. Wednesday is a weekday. " +
        "10:00 falls within the 09:00-17:00 window.",
    );
    assertArrayEquals(
      explanation.conditions.map(({ matched }) => matched),
      [true, true],
    );
  });

  it("shows which alternative matched", () => {
    // Given a weekend or a listed public-holiday date.
    const dayOff = any(dates("2026-12-25"), dates("2026-12-26", "2026-12-27"));

    // When Christmas Day is explained.
    const explanation = explainRule(dayOff, when("2026-12-25T10:00"));

    // Then the matching and non-matching alternatives are both visible.
    assertTrue(explanation.matched);
    assertArrayEquals(
      explanation.conditions.map(({ matched }) => matched),
      [true, false],
    );
    assertIdentical(
      explanation.conditions[0]?.description,
      "The date is 2026-12-25.",
    );
    assertIdentical(
      explanation.conditions[1]?.description,
      "2026-12-25 is not one of 2026-12-26 and 2026-12-27.",
    );
  });

  it("explains a match produced by excluding another rule", () => {
    // Given every date except Christmas Day.
    const workingDate = not(dates("2026-12-25"));

    // When the day after Christmas is explained.
    const explanation = explainRule(workingDate, when("2026-12-26T10:00"));

    // Then the excluded date's failure explains the outer match.
    assertTrue(explanation.matched);
    assertFalse(explanation.conditions[0]?.matched ?? true);
    assertIdentical(
      explanation.description,
      "The excluded condition does not match. The date is not 2026-12-25.",
    );
  });

  it("uses and names a rule's own time zone", () => {
    // Given Tokyo business hours viewed at the same instant from London.
    const tokyoHours = timeOfDay("09:00", "17:00", "Asia/Tokyo");
    const londonMorning = Temporal.ZonedDateTime.from(
      "2026-03-11T01:00[Europe/London]",
    );

    // When the Tokyo rule is explained.
    const explanation = explainRule(tokyoHours, londonMorning);

    // Then the local Tokyo clock time and zone make the match clear.
    assertTrue(explanation.matched);
    assertIdentical(
      explanation.description,
      "The rule uses Asia/Tokyo. 10:00 falls within the 09:00-17:00 window.",
    );
  });

  it("describes empty combinations directly", () => {
    // Given the identity rules for an empty intersection and union.
    const at = when("2026-03-11T10:00");

    // When each empty combination is explained.
    const every = explainRule(all(), at);
    const either = explainRule(any(), at);

    // Then each identity is stated without referring to missing conditions.
    assertIdentical(every.description, "An empty all rule always matches.");
    assertIdentical(either.description, "An empty any rule never matches.");
  });

  it("describes rules that always or never match", () => {
    // Given the two constant rules.
    const at = when("2026-03-11T10:00");

    // When both are explained.
    const everyTime = explainRule(always(), at);
    const noTime = explainRule(never(), at);

    // Then their fixed outcomes are stated directly.
    assertTrue(everyTime.matched);
    assertIdentical(everyTime.description, "This rule always matches.");
    assertFalse(noTime.matched);
    assertIdentical(noTime.description, "This rule never matches.");
  });

  it("explains failed compound rules", () => {
    // Given required, alternative, and excluded conditions that all fail.
    const at = when("2026-12-25T10:00");

    // When each compound rule is explained.
    const required = explainRule(all(weekdays(), dates("2026-12-26")), at);
    const alternative = explainRule(any(dates("2026-12-26")), at);
    const excluded = explainRule(not(dates("2026-12-25")), at);

    // Then the explanation names the reason for each failure.
    assertFalse(required.matched);
    assertStringIncludes(
      required.description,
      "A required condition does not match.",
    );
    assertFalse(alternative.matched);
    assertStringIncludes(alternative.description, "No alternative matches.");
    assertFalse(excluded.matched);
    assertStringIncludes(
      excluded.description,
      "The excluded condition matches.",
    );
  });

  it("describes empty and custom calendar lists", () => {
    // Given empty selectors and a custom three-day week.
    const monday = when("2026-03-09T10:00");
    const tuesday = when("2026-03-10T10:00");

    // When the selectors are explained.
    const noWeekdays = explainRule(daysOfWeek(), monday);
    const noDates = explainRule(dates(), monday);
    const oneDay = explainRule(daysOfWeek("monday"), monday);
    const threeDays = explainRule(
      daysOfWeek("monday", "wednesday", "friday"),
      tuesday,
    );
    const manyDates = explainRule(
      dates("2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12"),
      monday,
    );

    // Then empty and abbreviated lists still produce useful descriptions.
    assertIdentical(noWeekdays.description, "No weekdays are listed.");
    assertIdentical(noDates.description, "No dates are listed.");
    assertIdentical(oneDay.description, "Monday is included in Monday.");
    assertIdentical(
      threeDays.description,
      "Tuesday is not included in Monday, Wednesday, and Friday.",
    );
    assertIdentical(
      manyDates.description,
      "2026-03-09 is one of 4 listed dates.",
    );
  });

  it("names the day of the month it was asked about", () => {
    // Given the last day of the month, explained on 31 March, and the same
    // rule explained a day earlier.
    const monthEnd = daysOfMonth(-1);

    // When both are explained.
    const onTheDay = explainRule(monthEnd, when("2026-03-31T10:00"));
    const theDayBefore = explainRule(monthEnd, when("2026-03-30T10:00"));

    // Then the account says what was matched against rather than restating the
    // date, which is what makes it usable in an end-user answer.
    assertTrue(onTheDay.matched);
    assertIdentical(onTheDay.description, "The 31st matches the last day.");
    assertFalse(theDayBefore.matched);
    assertIdentical(
      theDayBefore.description,
      "The 30th does not match the last day.",
    );
  });

  it("describes days of the month written both ways round", () => {
    // Given the paydays a salary run uses, and an empty selector.
    const eleventh = when("2026-03-11T10:00");
    const paydays = explainRule(daysOfMonth(15, -1), eleventh);
    const none = explainRule(daysOfMonth(), eleventh);
    const secondLast = explainRule(daysOfMonth(-2), when("2026-03-30T10:00"));
    const many = explainRule(daysOfMonth(1, 2, 3, 4), eleventh);

    // Then each reads as English, including the day counted back from the end.
    assertIdentical(
      paydays.description,
      "The 11th does not match one of the 15th and the last day.",
    );
    assertIdentical(none.description, "No days of the month are listed.");
    assertIdentical(
      secondLast.description,
      "The 30th matches the 2nd-last day.",
    );
    assertIdentical(
      many.description,
      "The 11th does not match one of 4 listed days of the month.",
    );
  });

  it("names the month it was asked about", () => {
    // Given the summer months and an empty selector.
    const august = when("2026-08-14T10:00");
    const summer = explainRule(monthsOfYear("june", "july", "august"), august);
    const one = explainRule(monthsOfYear("january"), august);
    const none = explainRule(monthsOfYear(), august);

    // Then the month is named rather than numbered, in each shape.
    assertTrue(summer.matched);
    assertIdentical(
      summer.description,
      "August is included in June, July, and August.",
    );
    assertFalse(one.matched);
    assertIdentical(one.description, "August is not January.");
    assertIdentical(none.description, "No months are listed.");
  });

  it("describes an overnight window at a precise time", () => {
    // Given a night shift and a time with non-zero seconds.
    const shift = timeOfDay("22:00", "06:00");

    // When a time during the shift is explained.
    const explanation = explainRule(shift, when("2026-03-11T23:15:30"));

    // Then the overnight shape and precise time are both retained.
    assertTrue(explanation.matched);
    assertIdentical(
      explanation.description,
      "23:15:30 falls within the overnight 22:00-06:00 window.",
    );
  });

  it("explains a subtree in its selected time zone", () => {
    // Given Monday morning in Tokyo, viewed late on Sunday in London.
    const tokyoMonday = inZone(
      "Asia/Tokyo",
      all(weekdays(), timeOfDay("08:00", "09:00")),
    );
    const londonSunday = when("2026-03-08T23:30");

    // When the zoned subtree is explained.
    const explanation = explainRule(tokyoMonday, londonSunday);

    // Then every child uses Tokyo's calendar and clock.
    assertTrue(explanation.matched);
    assertStringIncludes(explanation.description, "The rule uses Asia/Tokyo.");
    assertStringIncludes(explanation.description, "Monday is a weekday.");
    assertStringIncludes(
      explanation.description,
      "08:30 falls within the 08:00-09:00 window.",
    );
  });
});
