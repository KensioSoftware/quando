import { inWindow, render, when } from "#test/intervals.js";
import {
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { atMostOccupiedTime } from "./build.js";
import { canonical } from "./canonical.js";
import { toCron } from "./cron-export.js";
import type { Occurrence } from "./occurrence.js";
import { MissingOccurrencesError } from "./occurrence.js";
import { parseRule } from "./parse.js";
import { isActiveAt, nextCoveredInterval } from "./query.js";
import { explainRule } from "./rule-explanation.js";
import type { RuleData } from "./rule.js";

describe("capping the total time something takes", () => {
  const days = (count: number): Temporal.Duration =>
    Temporal.Duration.from({ days: count });

  const hours = (count: number): Temporal.Duration =>
    Temporal.Duration.from({ hours: count });

  describe("a rolling window", () => {
    /** Ninety days of presence in any rolling one hundred and eighty. */
    const schengen = (): RuleData =>
      atMostOccupiedTime("P90D", { within: "P180D" });

    /**
     * A stay using the whole allowance, 1 January to 1 April.
     *
     * Read in UTC, where ninety calendar days and ninety times 24 hours are
     * the same length. See the clock-change case at the end.
     */
    const stay = (): Occurrence[] => [
      { at: when("2026-01-01T00:00", "UTC"), lasting: days(90) },
    ];

    it("is used up once the allowance is spent", () => {
      // Given a stay of the full ninety days ending on 1 April.
      // When a day in May is asked about.
      // Then it is refused, because the whole stay is still in the window.
      assertFalse(
        isActiveAt(schengen(), when("2026-05-01T00:00", "UTC"), {
          occurrences: stay(),
        }),
      );
    });

    it("frees up as the oldest days fall out of the window", () => {
      // Given the same stay, which began on 1 January.
      // When a day in July is asked about.
      // Then it is allowed, because the start of the stay is more than one
      // hundred and eighty days behind.
      assertTrue(
        isActiveAt(schengen(), when("2026-07-01T00:00", "UTC"), {
          occurrences: stay(),
        }),
      );
    });

    it("reopens one hundred and eighty days after the stay began", () => {
      // Given the same stay, and a window opening while it is still spent.
      const window = {
        ...inWindow("2026-04-15T00:00", "2026-12-01T00:00", "UTC"),
        occurrences: stay(),
      };

      // When the next allowed stretch is asked for.
      const next = nextCoveredInterval(schengen(), window);

      // Then it opens on 30 June, which is 1 January plus one hundred and
      // eighty days.
      assertIdentical(
        render(next === undefined ? [] : [next]),
        "[2026-06-30T00:00:00,2026-12-01T00:00:00)",
      );
    });

    it("counts overlapping stays once", () => {
      // Given two records of the same fifty days, which is a duplicate rather
      // than a hundred days of presence.
      const twice: Occurrence[] = [
        { at: when("2026-01-01T00:00", "UTC"), lasting: days(50) },
        { at: when("2026-01-01T00:00", "UTC"), lasting: days(50) },
      ];

      // When a day after both is asked about.
      // Then it is allowed, because nobody is in two places at once.
      assertTrue(
        isActiveAt(schengen(), when("2026-03-01T00:00", "UTC"), {
          occurrences: twice,
        }),
      );
    });
  });

  describe("a calendar bucket", () => {
    /** Fifty-six hours of driving in a week. */
    const tachograph = (): RuleData =>
      atMostOccupiedTime("PT56H", { per: "week" });

    /** A stint using the week's whole allowance, from Monday. */
    const driven = (): Occurrence[] => [
      { at: when("2026-03-09T00:00"), lasting: hours(56) },
    ];

    it("closes the whole week once it is full", () => {
      // Given fifty-six hours driven from Monday morning.
      // When the Friday of that week is asked about.
      // Then it is refused.
      assertFalse(
        isActiveAt(tachograph(), when("2026-03-13T10:00"), {
          occurrences: driven(),
        }),
      );
    });

    it("closes the part of the week before the driving too", () => {
      // Given the same week.
      // When the Monday morning it began is asked about.
      // Then it is refused, because a full week is full at either end of it.
      assertFalse(
        isActiveAt(tachograph(), when("2026-03-09T00:00"), {
          occurrences: driven(),
        }),
      );
    });

    it("starts again in the next bucket", () => {
      // Given the same week.
      // When the Monday after it is asked about.
      // Then it is allowed, because a calendar bucket resets.
      assertTrue(
        isActiveAt(tachograph(), when("2026-03-16T10:00"), {
          occurrences: driven(),
        }),
      );
    });

    it("splits a stretch that runs over midnight between the two days", () => {
      // Given four hours running from ten at night to two in the morning,
      // which is two hours in each of two days.
      const overnight: Occurrence[] = [
        { at: when("2026-03-09T22:00"), lasting: hours(4) },
      ];

      // When a cap of three hours a day is asked about either day.
      const rule = atMostOccupiedTime("PT3H", { per: "day" });

      // Then both are allowed, because neither day holds more than two hours.
      assertTrue(
        isActiveAt(rule, when("2026-03-09T12:00"), { occurrences: overnight }),
      );
      assertTrue(
        isActiveAt(rule, when("2026-03-10T12:00"), { occurrences: overnight }),
      );
    });

    it("fills both days when the cap is low enough", () => {
      // Given the same four hours over midnight.
      const overnight: Occurrence[] = [
        { at: when("2026-03-09T22:00"), lasting: hours(4) },
      ];

      // When a cap of two hours a day is asked about either day.
      const rule = atMostOccupiedTime("PT2H", { per: "day" });

      // Then both are refused, because each holds its whole two hours.
      assertFalse(
        isActiveAt(rule, when("2026-03-09T12:00"), { occurrences: overnight }),
      );
      assertFalse(
        isActiveAt(rule, when("2026-03-10T12:00"), { occurrences: overnight }),
      );
    });
  });

  describe("several stays in one window", () => {
    it("stays spent while the allowance is spread across them", () => {
      // Given two stays of forty-five days each, 1 January to 15 February and
      // 1 March to 15 April, against a cap of forty-five days in any 180.
      const stays: Occurrence[] = [
        { at: when("2026-01-01T00:00", "UTC"), lasting: days(45) },
        { at: when("2026-03-01T00:00", "UTC"), lasting: days(45) },
      ];
      const window = {
        ...inWindow("2026-03-01T00:00", "2026-12-01T00:00", "UTC"),
        occurrences: stays,
      };

      // When the next allowed stretch is asked for.
      const next = nextCoveredInterval(
        atMostOccupiedTime("P45D", { within: "P180D" }),
        window,
      );

      // Then nothing opens until 28 August, which is 1 March plus 180 days,
      // when the second stay finally falls out of the window.
      assertIdentical(
        render(next === undefined ? [] : [next]),
        "[2026-08-28T00:00:00,2026-12-01T00:00:00)",
      );
    });
  });

  describe("across a clock change", () => {
    it("counts what a stay lasted rather than what it was called", () => {
      // Given ninety days from a London midnight in January, which runs over
      // the spring clock change and so lasts 89 days and 23 hours.
      const stay: Occurrence[] = [
        { at: when("2026-01-01T00:00"), lasting: days(90) },
      ];

      // When a cap of ninety days, read as ninety times 24 hours, is asked
      // about a day inside the window.
      // Then the stay is an hour short of filling it.
      assertTrue(
        isActiveAt(
          atMostOccupiedTime("P90D", { within: "P180D" }),
          when("2026-05-01T00:00"),
          {
            occurrences: stay,
          },
        ),
      );

      // And an hour more of it fills the cap exactly.
      const withTheHour: Occurrence[] = [
        { at: when("2026-01-01T00:00"), lasting: days(90).add({ hours: 1 }) },
      ];
      assertFalse(
        isActiveAt(
          atMostOccupiedTime("P90D", { within: "P180D" }),
          when("2026-05-01T00:00"),
          {
            occurrences: withTheHour,
          },
        ),
      );
    });
  });

  describe("what fills a cap", () => {
    it("is unmoved by occurrences that took no time", () => {
      // Given four doses, none of which record how long they went on.
      const doses: Occurrence[] = ["08:00", "12:00", "16:00", "20:00"].map(
        (hour) => ({ at: when(`2026-03-10T${hour}`) }),
      );

      // When a cap on time is asked about that day.
      // Then nothing is refused, because a moment fills no part of a window.
      assertTrue(
        isActiveAt(
          atMostOccupiedTime("PT1H", { per: "day" }),
          when("2026-03-10T21:00"),
          {
            occurrences: doses,
          },
        ),
      );
    });

    it("refuses to answer with no history at all", () => {
      // Given a context that says nothing about what has happened.
      const asking = (): boolean =>
        isActiveAt(
          atMostOccupiedTime("PT56H", { per: "week" }),
          when("2026-03-13T10:00"),
        );

      // Then it refuses, the way every constraint does.
      assertInstanceOf(assertThrowsError(asking), MissingOccurrencesError);
    });
  });

  describe("the durations it accepts", () => {
    it("refuses a window whose length depends on where it falls", () => {
      // Given a cap written in months.
      const writing = (): RuleData =>
        atMostOccupiedTime("PT1H", { within: "P1M" });

      // Then it is refused, because a month is four different lengths.
      const refusal = assertThrowsError(writing);
      assertInstanceOf(refusal, RangeError);
      assertStringIncludes(refusal.message, "months vary in length");
    });

    it("refuses a total written in weeks", () => {
      // Given an allowance written in weeks.
      const writing = (): RuleData =>
        atMostOccupiedTime("P2W", { within: "P180D" });

      // Then it is refused for the same reason.
      assertStringIncludes(
        assertThrowsError(writing).message,
        "weeks vary in length",
      );
    });
  });

  describe("as a document", () => {
    it("survives a round trip through JSON", () => {
      // Given a cap written out and read back.
      const written = JSON.stringify(
        atMostOccupiedTime("P90D", { within: "P180D" }),
      );
      const read = parseRule(JSON.parse(written));

      // When the same question is asked of the rule that came back.
      // Then it answers the way the original did.
      assertFalse(
        isActiveAt(read, when("2026-05-01T00:00", "UTC"), {
          occurrences: [
            { at: when("2026-01-01T00:00", "UTC"), lasting: days(90) },
          ],
        }),
      );
    });

    it("canonicalises to the fields in a fixed order", () => {
      // Given a cap on time.
      const rule = atMostOccupiedTime("PT56H", { per: "week" });

      // When it is canonicalised.
      // Then the window it counts in stays the one it was written with.
      assertIdentical(
        JSON.stringify(canonical(rule)),
        '{"type":"atMostTime","total":"PT56H","per":"weeks"}',
      );
    });

    it("refuses to be written as cron, saying why", () => {
      // Given a cap on time.
      const written = toCron(atMostOccupiedTime("PT56H", { per: "week" }));

      // Then cron cannot carry it, because it has nowhere to put a history.
      assertFalse(written.ok);
      assertStringIncludes(written.reason, "caps or spaces occurrences");
    });
  });

  describe("the fields a document may hold", () => {
    it("refuses a document naming both windows", () => {
      // Given a cap on time that says both how it counts.
      const reading = (): RuleData =>
        parseRule({
          type: "atMostTime",
          total: "PT1H",
          per: "days",
          within: "PT24H",
        });

      // Then it is refused, because the two mean different things.
      assertStringIncludes(assertThrowsError(reading).message, "names both");
    });

    it("refuses a document naming neither", () => {
      // Given a cap on time with no window at all.
      const reading = (): RuleData =>
        parseRule({ type: "atMostTime", total: "PT1H" });

      // Then it is refused, because the window is what a cap counts in.
      assertStringIncludes(
        assertThrowsError(reading).message,
        "a cap needs a window",
      );
    });

    it("keeps the zone it counts buckets in", () => {
      // Given a cap counting days on a Tokyo clock.
      const rule = atMostOccupiedTime("PT2H", {
        per: "day",
        zone: "Asia/Tokyo",
      });

      // When it is written out and read back.
      const read = parseRule(structuredClone<unknown>(rule));

      // Then the zone survives, so the day it counts is the same one.
      assertIdentical(
        JSON.stringify(read),
        '{"type":"atMostTime","total":"PT2H","per":"days","zone":"Asia/Tokyo"}',
      );
    });
  });

  describe("explaining", () => {
    it("says how much of the window is already taken up", () => {
      // Given a stay from 1 January to 1 April, asked about on 1 August. The
      // window then reaches back to 2 February, so 58 of the 90 days are
      // still inside it.
      const account = explainRule(
        atMostOccupiedTime("P90D", { within: "P180D" }),
        when("2026-08-01T00:00", "UTC"),
        {
          occurrences: [
            { at: when("2026-01-01T00:00", "UTC"), lasting: days(90) },
          ],
        },
      );

      // When the account is read.
      // Then it names what is used and what is allowed.
      assertTrue(account.status === "matched");
      assertStringIncludes(account.description, "58 days");
      assertStringIncludes(account.description, "at most 90 days is allowed");
    });

    it("says how full a calendar bucket is", () => {
      // Given fifty-six hours driven from Monday, asked about on the Friday.
      const account = explainRule(
        atMostOccupiedTime("PT56H", { per: "week" }),
        when("2026-03-13T10:00"),
        {
          occurrences: [{ at: when("2026-03-09T00:00"), lasting: hours(56) }],
        },
      );

      // When the account is read.
      // Then it names the week and what filled it, fifty-six hours being two
      // days and eight.
      assertFalse(account.status === "matched");
      assertStringIncludes(account.description, "2 days 8 hours of this week");
      assertStringIncludes(account.description, "the most allowed");
    });

    it("counts only the part of a stretch inside the bucket", () => {
      // Given four hours running from ten at night into the next day, asked
      // about on the first of the two days.
      const account = explainRule(
        atMostOccupiedTime("PT3H", { per: "day" }),
        when("2026-03-09T12:00"),
        {
          occurrences: [{ at: when("2026-03-09T22:00"), lasting: hours(4) }],
        },
      );

      // When the account is read.
      // Then two of the four hours are counted, because the rest is tomorrow.
      assertTrue(account.status === "matched");
      assertStringIncludes(account.description, "2 hours of this day");
    });
  });
});
