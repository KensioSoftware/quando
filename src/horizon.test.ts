import { inWindow, render, span, when } from "#test/intervals.js";
import {
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { uncertain } from "./bounds.js";
import {
  all,
  always,
  any,
  custom,
  dates,
  daysOfMonth,
  inCalendar,
  inZone,
  never,
  not,
  weekdays,
} from "./build.js";
import { canonical } from "./canonical.js";
import { toCron } from "./cron-export.js";
import type { RuleRegistry } from "./custom-rules.js";
import type { IntervalStream } from "./interval-stream.js";
import { knownThrough } from "./horizon.js";
import { BeyondHorizonError } from "./horizon-guard.js";
import { parseRule } from "./parse.js";
import {
  activeAt,
  advanceBy,
  coveredDuration,
  nextCoveredInterval,
} from "./query.js";
import { explainRule } from "./rule-explanation.js";
import type { Rule } from "./rule.js";

describe("a rule that says how far it is known", () => {
  /** Christmas, from a table that was only loaded as far as 2026. */
  const holidays = (): Rule => knownThrough("2026-12-31", dates("2026-12-25"));

  /** Open on weekdays, closed on the holidays anybody has heard about. */
  const open = (): Rule => all(weekdays(), not(holidays()));

  /** Monday 2029-04-02 to the Monday after it, well past the horizon. */
  const BEYOND = inWindow("2029-04-02T00:00", "2029-04-09T00:00");

  /** Monday 2026-03-09 to the Monday after it, with the horizon ahead. */
  const WITHIN = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

  describe("costing nothing to a rule without one", () => {
    it("answers for any year at all", () => {
      // Given a rule that declares no horizon, asked about a distant Tuesday.
      // When it is asked.
      // Then it answers, the way it did before horizons existed.
      assertTrue(activeAt(weekdays(), when("2029-04-03T10:00")));
    });

    it("has nothing it cannot answer for", () => {
      // Given a schedule with no horizon anywhere in it.
      const schedule = all(weekdays(), not(dates("2026-12-25")));

      // When it is asked where its answer runs out.
      // When rendered, an empty stream is an empty string.
      const fog = uncertain(schedule, BEYOND);
      assertIdentical(render(fog), "");
    });
  });

  describe("within the horizon", () => {
    it("answers as though no horizon were there", () => {
      // Given a Monday in March 2026, which the holiday table covers.
      // When the schedule is asked about mid-morning.
      // Then it answers plainly.
      assertTrue(activeAt(open(), when("2026-03-09T10:00")));
    });

    it("leaves nothing unknown", () => {
      // Given a week the holiday table was loaded for.
      // When the schedule is asked where its answer runs out.
      // Then nowhere in that week.
      const fog = uncertain(open(), WITHIN);
      assertIdentical(render(fog), "");
    });

    it("counts covered time", () => {
      // Given a week inside the horizon.
      // When the covered time is totalled.
      // Then five whole weekdays come back.
      const total = coveredDuration(open(), WITHIN);
      assertIdentical(total.toString(), "PT120H");
    });
  });

  describe("beyond the horizon", () => {
    it("refuses a day the missing data could have changed", () => {
      // Given a Tuesday in 2029, which no holiday table has been loaded for.
      // When the schedule is asked about it.
      const asking = (): boolean => activeAt(open(), when("2029-04-03T10:00"));

      // Then it refuses rather than reporting a Tuesday as open.
      const refusal = assertThrowsError(asking);
      assertInstanceOf(refusal, BeyondHorizonError);
      assertStringIncludes(refusal.message, "2029-04-03");
    });

    it("still answers a day the missing data could not have changed", () => {
      // Given a Saturday in 2029, past the same horizon.
      // When the schedule is asked about it.
      // Then it is closed, because a missing holiday cannot open a weekend.
      assertFalse(activeAt(open(), when("2029-04-07T10:00")));
    });

    it("names exactly the stretches it cannot answer for", () => {
      // Given a week in 2029, past the horizon of the holiday table.
      // When the schedule is asked where its answer runs out.
      // Then only the weekdays, running to the start of the Saturday.
      const fog = uncertain(open(), BEYOND);
      assertIdentical(render(fog), "[2029-04-02T00:00:00,2029-04-07T00:00:00)");
    });
  });

  describe("composing", () => {
    it("stays false where a certain no settles it", () => {
      // Given a rule that covers nothing, and beside it one nobody can answer.
      const rule = all(never(), knownThrough("2026-12-31", always()));

      // When it is asked about a Tuesday past the horizon.
      // Then it is false, because both conditions must hold and one cannot.
      assertFalse(activeAt(rule, when("2029-04-03T10:00")));
    });

    it("stays true where a certain yes settles it", () => {
      // Given a rule that covers everything, or one nobody can answer.
      const rule = any(always(), knownThrough("2026-12-31", never()));

      // When it is asked about a Tuesday past the horizon.
      // Then it is true, because one alternative holds whatever the other says.
      assertTrue(activeAt(rule, when("2029-04-03T10:00")));
    });

    it("carries the fog through an exclusion", () => {
      // Given an exclusion of something nobody can answer past the horizon.
      const rule = not(knownThrough("2026-12-31", always()));

      // When it is asked about a Tuesday past that horizon.
      const asking = (): boolean => activeAt(rule, when("2029-04-03T10:00"));

      // Then it refuses, rather than reporting the exclusion as not applying.
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });
  });

  describe("the questions a query asks", () => {
    it("refuses a total that would count time nobody has", () => {
      // Given a window running past the end of the holiday table.
      const window = inWindow("2026-12-28T00:00", "2027-01-11T00:00");

      // When the covered time is totalled over it.
      const asking = (): Temporal.Duration => coveredDuration(open(), window);

      // Then it refuses rather than returning a number that is part guess.
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });

    it("answers when the fog falls after the stretch it finds", () => {
      // Given a window that opens well inside the horizon and closes past it.
      const window = inWindow("2026-12-21T00:00", "2027-01-11T00:00");

      // When the next covered stretch is asked for.
      const next = nextCoveredInterval(open(), window);

      // Then Monday the 21st comes back, because nothing before it is in doubt.
      assertIdentical(
        render(next === undefined ? [] : [next]),
        "[2026-12-21T00:00:00,2026-12-25T00:00:00)",
      );
    });

    it("refuses when the fog falls before it", () => {
      // Given a window that opens past the horizon.
      const window = inWindow("2027-01-04T00:00", "2027-01-11T00:00");

      // When the next covered stretch is asked for.
      const asking = (): unknown => nextCoveredInterval(open(), window);

      // Then it refuses, because an unknown stretch might have been the answer.
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });

    it("refuses to advance through time nobody has", () => {
      // Given an instant a few days before the horizon.
      const from = when("2026-12-28T09:00");

      // When asked where two hundred open hours land.
      const asking = (): unknown =>
        advanceBy(from, Temporal.Duration.from({ hours: 200 }), {
          during: open(),
          within: Temporal.Duration.from({ days: 60 }),
        });

      // Then it refuses rather than counting hours it cannot vouch for.
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });
  });

  describe("reading the day a horizon names", () => {
    it("ends the day in the zone the horizon names", () => {
      // Given a horizon that runs to the end of 2026 in Tokyo, which is
      // mid-afternoon in London on the same date.
      const rule = knownThrough("2026-12-31", weekdays(), "Asia/Tokyo");

      // When the schedule is asked either side of that instant.
      const asking = (): boolean => activeAt(rule, when("2026-12-31T16:00"));

      // Then a London afternoon is already past a Tokyo horizon, and a London
      // lunchtime is not.
      assertTrue(activeAt(rule, when("2026-12-31T14:00")));
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });

    it("carries through a zone scope", () => {
      // Given a horizon inside a rule read on another clock.
      const rule = inZone("Asia/Tokyo", knownThrough("2026-12-31", weekdays()));

      // When it is asked about a Tuesday in 2029.
      const asking = (): boolean => activeAt(rule, when("2029-04-03T10:00"));

      // Then the horizon is still there, read on the clock the scope named.
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });

    it("carries through a calendar scope", () => {
      // Given a horizon inside a rule counted on another calendar.
      const rule = inCalendar(
        "hebrew",
        knownThrough("2026-12-31", daysOfMonth(1)),
      );

      // When it is asked about a day in 2029.
      const asking = (): boolean => activeAt(rule, when("2029-04-03T10:00"));

      // Then the horizon survives the change of calendar.
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });

    it("spreads fog across an alternative that cannot rule it out", () => {
      // Given a choice between something unknown past 2026 and nothing at all.
      const rule = any(knownThrough("2026-12-31", weekdays()), never());

      // When it is asked where its answer runs out in 2029.
      const fog = uncertain(rule, BEYOND);

      // Then the whole week, because an alternative nobody can answer leaves
      // every moment of it open.
      assertIdentical(render(fog), "[2029-04-02T00:00:00,2029-04-09T00:00:00)");
    });
  });

  describe("a horizon the registry declares", () => {
    const christmas = (): IntervalStream => [
      span("2026-12-25T00:00", "2026-12-26T00:00"),
    ];

    /** A holiday table that says how far it was loaded. */
    const loaded: RuleRegistry = {
      holidays: { intervals: christmas, known: () => "2026-12-31" },
    };

    /** The same table, saying nothing about how far it goes. */
    const silent: RuleRegistry = { holidays: { intervals: christmas } };

    const schedule = (): Rule => all(weekdays(), not(custom("holidays")));

    it("refuses past what the table was loaded for", () => {
      // Given a table that declares it holds 2026 and no further.
      // When the schedule is asked about a Tuesday in 2029.
      const asking = (): boolean =>
        activeAt(schedule(), when("2029-04-03T10:00"), { rules: loaded });

      // Then it refuses, on a horizon the stored document never mentioned.
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });

    it("answers for a table that claims all of time", () => {
      // Given the same document and a table that declares no horizon.
      // When the schedule is asked about the same Tuesday.
      // Then it answers, because nothing has said the data runs out.
      assertTrue(
        activeAt(schedule(), when("2029-04-03T10:00"), { rules: silent }),
      );
    });
  });

  describe("as a document", () => {
    it("survives a round trip through JSON", () => {
      // Given a horizon written out and read back.
      const written = JSON.stringify(holidays());

      // When it is parsed.
      const read = parseRule(JSON.parse(written));

      // Then it still refuses past its horizon.
      const asking = (): boolean =>
        activeAt(not(read), when("2029-04-03T10:00"));
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });

    it("keeps its horizon through canonicalisation", () => {
      // Given a horizon over a rule written the long way round.
      const rule = knownThrough("2026-12-31", any(dates("2026-12-25")));

      // When it is canonicalised.
      const tidied = canonical(rule);

      // Then the horizon is still there with the day it named.
      assertIdentical(
        JSON.stringify(tidied),
        '{"type":"known","through":"2026-12-31",' +
          '"rule":{"type":"dates","dates":["2026-12-25"]}}',
      );
    });

    it("refuses to be written as cron, saying why", () => {
      // Given a rule whose answer runs out at the end of 2026.
      const rule = knownThrough("2026-12-31", weekdays());

      // When it is written as a cron expression.
      const written = toCron(rule);

      // Then it is refused, because cron would state it as holding forever.
      assertFalse(written.ok);
      assertStringIncludes(written.reason, "only known through 2026-12-31");
    });
  });

  describe("explaining", () => {
    it("says the answer is unknown rather than saying no", () => {
      // Given a schedule asked about a Tuesday past its horizon.
      const account = explainRule(open(), when("2029-04-03T10:00"));

      // When the account is read.
      // Then it reports that nothing is known, rather than reporting a miss.
      assertFalse(account.known);
      assertFalse(account.matched);
      assertStringIncludes(account.description, "not known");
    });

    it("explains plainly inside the horizon", () => {
      // Given the same schedule asked about a Monday it has the data for.
      const account = explainRule(open(), when("2026-03-09T10:00"));

      // When the account is read.
      // Then it is an ordinary matching account.
      assertTrue(account.known);
      assertTrue(account.matched);
    });
  });
});
