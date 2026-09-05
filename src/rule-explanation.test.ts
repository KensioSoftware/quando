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

  it("counts which occurrence of the weekday a date is", () => {
    // Given the second Tuesday of the month, explained on the second Tuesday
    // of March 2026 and on the third.
    const patchTuesday = nthDayOfWeekInMonth(2, "tuesday");

    // When both are explained.
    const onTheDay = explainRule(patchTuesday, when("2026-03-10T10:00"));
    const aWeekLater = explainRule(patchTuesday, when("2026-03-17T10:00"));

    // Then the count is stated either way. It is the fact the reader cannot
    // see from the date, and it is the whole reason the rule matched or not.
    assertTrue(onTheDay.matched);
    assertIdentical(
      onTheDay.description,
      "This is the 2nd Tuesday of the month.",
    );
    assertFalse(aWeekLater.matched);
    assertIdentical(
      aWeekLater.description,
      "This is the 3rd Tuesday of the month, and the rule wants the 2nd.",
    );
  });

  it("counts back from the end of the month for a negative occurrence", () => {
    // Given the last Friday of the month, explained on it.
    const monthEnd = nthDayOfWeekInMonth(-1, "friday");

    // When 27 March 2026 is explained. March has four Fridays and this is the
    // last of them.
    const explanation = explainRule(monthEnd, when("2026-03-27T10:00"));

    // Then the account counts from the end, the way the rule does.
    assertTrue(explanation.matched);
    assertIdentical(
      explanation.description,
      "This is the last Friday of the month.",
    );
  });

  it("settles a weekday mismatch without counting", () => {
    // Given the first Monday, explained on a Wednesday, and an empty selector.
    const wednesday = when("2026-03-11T10:00");
    const wrongDay = explainRule(nthDayOfWeekInMonth(1, "monday"), wednesday);
    const none = explainRule(nthDayOfWeekInMonth(1), wednesday);

    // Then the weekday alone settles it. Counting Mondays on a Wednesday
    // would be an answer to a question nobody asked.
    assertFalse(wrongDay.matched);
    assertIdentical(wrongDay.description, "Wednesday is not Monday.");
    assertIdentical(none.description, "No weekdays are listed.");
  });

  it("says which cycle of a recurrence the instant is in", () => {
    // Given a fortnightly cycle anchored on Monday 9 March, explained on the
    // anchor, one week later, and two weeks later.
    const fortnightly = every(2, "weeks", { anchor: "2026-03-09" });

    // When each is explained.
    const onAnchor = explainRule(fortnightly, when("2026-03-09T10:00"));
    const weekAfter = explainRule(fortnightly, when("2026-03-16T10:00"));
    const fortnightAfter = explainRule(fortnightly, when("2026-03-23T10:00"));

    // Then the count of periods from the anchor is stated, which is the fact
    // the reader cannot get from the date.
    assertTrue(onAnchor.matched);
    assertIdentical(
      onAnchor.description,
      "This is in the same week as 2026-03-09, so it is on every 2 weeks.",
    );
    assertFalse(weekAfter.matched);
    assertIdentical(
      weekAfter.description,
      "This is 1 week after 2026-03-09, so it is not on every 2 weeks.",
    );
    assertTrue(fortnightAfter.matched);
    assertIdentical(
      fortnightAfter.description,
      "This is 2 weeks after 2026-03-09, so it is on every 2 weeks.",
    );
  });

  it("counts back when the instant is before the anchor", () => {
    // Given a quarterly cycle anchored in April, explained on a date before
    // it. The anchor sets the phase and is not a bound.
    const quarterly = every(3, "months", { anchor: "2026-04-01" });

    // When January is explained.
    const explanation = explainRule(quarterly, when("2026-01-15T10:00"));

    // Then the account counts backwards and the cycle still matches.
    assertTrue(explanation.matched);
    assertIdentical(
      explanation.description,
      "This is 3 months before 2026-04-01, so it is on every 3 months.",
    );
  });

  it("says every day rather than every 1 days", () => {
    // Given the interval RRULE leaves out.
    const daily = every(1, "days", { anchor: "2026-03-09" });

    // When a later day is explained.
    const explanation = explainRule(daily, when("2026-03-10T10:00"));

    // Then the count reads as English rather than as the field it came from.
    assertIdentical(
      explanation.description,
      "This is 1 day after 2026-03-09, so it is on every day.",
    );
  });

  it("says which side of a date bound the instant falls", () => {
    // Given a season, a start and an end, explained on a date outside all
    // three and on one inside them.
    const inside = when("2026-07-15T10:00");
    const outside = when("2026-03-15T10:00");
    const summer = between("2026-06-01", "2026-08-31");

    // When each is explained.
    const within = explainRule(summer, inside);
    const before = explainRule(summer, outside);
    const started = explainRule(onOrAfter("2026-06-01"), inside);
    const notYet = explainRule(onOrAfter("2026-06-01"), outside);
    const stillOpen = explainRule(onOrBefore("2026-08-31"), inside);

    // Then each account names the bound it was measured against, which is the
    // thing the reader cannot see from the date.
    assertTrue(within.matched);
    assertIdentical(
      within.description,
      "2026-07-15 falls within 2026-06-01 to 2026-08-31.",
    );
    assertFalse(before.matched);
    assertIdentical(
      before.description,
      "2026-03-15 falls outside 2026-06-01 to 2026-08-31.",
    );
    assertIdentical(
      started.description,
      "2026-07-15 is on or after 2026-06-01.",
    );
    assertIdentical(notYet.description, "2026-03-15 is before 2026-06-01.");
    assertIdentical(
      stillOpen.description,
      "2026-07-15 is on or before 2026-08-31.",
    );
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
