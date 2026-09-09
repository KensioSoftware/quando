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

import { all, atMostOccurrences, minimumGap, weekdays } from "./build.js";
import { canonical, sameDefinition } from "./canonical.js";
import { toCron } from "./cron-export.js";
import { MissingOccurrencesError, type Occurrence } from "./occurrence.js";
import { parseRule } from "./parse.js";
import { isActiveAt, nextCoveredInterval } from "./query.js";
import { explainRule } from "./rule-explanation.js";

describe("constraints on what has already happened", () => {
  /** Moments on one day, as a history of doses taken. */
  const taken = (...times: readonly string[]): Occurrence[] =>
    times.map((time) => ({ at: when(`2026-03-10T${time}`) }));

  /** Whether an instant is permitted, given a history. */
  const permits = (
    rule: Parameters<typeof isActiveAt>[0],
    at: string,
    occurrences: readonly Occurrence[],
  ): boolean => isActiveAt(rule, when(at), { occurrences });

  describe("a cap on a rolling window", () => {
    it("permits one more while the window has room", () => {
      // Given three doses in the last day, and a cap of four.
      // When a fourth is asked about.
      // Then it is permitted. The window holds three.
      assertTrue(
        permits(
          atMostOccurrences(4, { within: "PT24H" }),
          "2026-03-10T20:00",
          taken("08:00", "12:00", "16:00"),
        ),
      );
    });

    it("refuses one more once the window is full", () => {
      // Given four doses in the last day.
      // When a fifth is asked about.
      // Then it is refused.
      assertFalse(
        permits(
          atMostOccurrences(4, { within: "PT24H" }),
          "2026-03-10T21:00",
          taken("08:00", "12:00", "16:00", "20:00"),
        ),
      );
    });

    it("lets the oldest fall out of the window rather than resetting", () => {
      // Given four doses on the hours 08:00 to 20:00.
      const history = taken("08:00", "12:00", "16:00", "20:00");

      // When the instant a full day after the first is asked about.
      // Then it is permitted, because the 08:00 dose has aged out and three
      // are left. Nothing about midnight matters to a rolling window.
      assertTrue(
        permits(
          atMostOccurrences(4, { within: "PT24H" }),
          "2026-03-11T08:00",
          history,
        ),
      );

      // And a nanosecond earlier it is not, because the 08:00 dose is still
      // inside the day looking back.
      assertFalse(
        permits(
          atMostOccurrences(4, { within: "PT24H" }),
          "2026-03-11T07:59:59.999999999",
          history,
        ),
      );
    });

    it("says when the next one is due", () => {
      // Given a day's doses, four hours apart, and both rules at once.
      const dosing = all(
        atMostOccurrences(4, { within: "PT24H" }),
        minimumGap("PT4H"),
      );
      const history = taken("08:00", "12:00", "16:00", "20:00");

      // When the next permitted stretch is looked for.
      const next = nextCoveredInterval(dosing, {
        from: when("2026-03-10T20:30"),
        occurrences: history,
      });

      // Then it opens a full day after the first dose. Every ordinary query
      // works on a constraint, because a constraint with a history behind it
      // is an ordinary set of times.
      assertIdentical(
        next?.start?.toPlainDateTime().toString(),
        "2026-03-11T08:00:00",
      );
    });
  });

  describe("a cap on calendar buckets", () => {
    it("starts the count again at the boundary", () => {
      // Given two visits on the 10th, and a cap of two a day.
      const history = taken("08:00", "20:00");

      // When the same hour on the 10th and on the 11th are asked about.
      // Then the day is full and the next day is empty. A bucket resets where
      // a rolling window would still be counting.
      assertFalse(
        permits(
          atMostOccurrences(2, { per: "day" }),
          "2026-03-10T22:00",
          history,
        ),
      );
      assertTrue(
        permits(
          atMostOccurrences(2, { per: "day" }),
          "2026-03-11T06:00",
          history,
        ),
      );
    });

    it("closes a full bucket at both ends of itself", () => {
      // Given two visits later in the day, filling it.
      // When an hour before either of them is asked about.
      // Then it is refused. A full day is full whichever end is asked about,
      // and nothing can be slipped in earlier after the fact.
      assertFalse(
        permits(
          atMostOccurrences(2, { per: "day" }),
          "2026-03-10T06:00",
          taken("08:00", "20:00"),
        ),
      );
    });

    it("joins two full buckets that touch", () => {
      // Given one visit on each of two days, capped at one a day.
      const history = [
        { at: when("2026-03-10T09:00") },
        { at: when("2026-03-11T09:00") },
      ];

      // When each day and the one after are asked about.
      // Then both days are closed and the third is open. The two full days
      // meet at midnight and coalesce into one stretch, which is what keeps
      // the stream the algebra needs.
      assertFalse(
        permits(
          atMostOccurrences(1, { per: "day" }),
          "2026-03-10T20:00",
          history,
        ),
      );
      assertFalse(
        permits(
          atMostOccurrences(1, { per: "day" }),
          "2026-03-11T20:00",
          history,
        ),
      );
      assertTrue(
        permits(
          atMostOccurrences(1, { per: "day" }),
          "2026-03-12T20:00",
          history,
        ),
      );
    });

    it("counts a week from Monday", () => {
      // Given two visits on a Tuesday and a Thursday, capped at two a week.
      const history = [when("2026-03-10T09:00"), when("2026-03-12T09:00")].map(
        (at) => ({ at }),
      );

      // When the Sunday that ends that week and the Monday that opens the
      // next are asked about.
      // Then the week is full to its end and the next one is open.
      assertFalse(
        permits(
          atMostOccurrences(2, { per: "week" }),
          "2026-03-15T09:00",
          history,
        ),
      );
      assertTrue(
        permits(
          atMostOccurrences(2, { per: "week" }),
          "2026-03-16T09:00",
          history,
        ),
      );
    });
  });

  describe("a minimum spacing", () => {
    it("refuses an instant too close after an occurrence", () => {
      // Given one dose at noon and a four-hour gap.
      const history = taken("12:00");

      // When just before and just after four hours later are asked about.
      // Then exactly four hours is far enough, and a nanosecond less is not.
      assertTrue(permits(minimumGap("PT4H"), "2026-03-10T16:00", history));
      assertFalse(
        permits(minimumGap("PT4H"), "2026-03-10T15:59:59.999999999", history),
      );
    });

    it("refuses an instant too close before one, the same way", () => {
      // Given the same dose at noon.
      const history = taken("12:00");

      // When four hours earlier and a nanosecond later than that are asked
      // about.
      // Then the rule reads both ways round. Two things four hours apart are
      // four hours apart whichever came first, and a check on a plan needs
      // that as much as a query looking forward does.
      assertTrue(permits(minimumGap("PT4H"), "2026-03-10T08:00", history));
      assertFalse(
        permits(minimumGap("PT4H"), "2026-03-10T08:00:00.000000001", history),
      );
    });

    it("measures from the end of something that lasted", () => {
      // Given a shift running from nine until noon, and an hour's rest.
      const shift = [
        {
          at: when("2026-03-10T09:00"),
          lasting: Temporal.Duration.from({ hours: 3 }),
        },
      ];

      // When one o'clock and a minute before it are asked about.
      // Then the hour is counted from when the shift finished rather than
      // from when it started.
      assertTrue(permits(minimumGap("PT1H"), "2026-03-10T13:00", shift));
      assertFalse(permits(minimumGap("PT1H"), "2026-03-10T12:59", shift));
    });
  });

  describe("the history it is given", () => {
    it("permits everything when nothing has happened", () => {
      // Given an empty history.
      // When anything is asked about.
      // Then it is permitted. Nothing has been used up.
      assertTrue(
        permits(atMostOccurrences(1, { per: "day" }), "2026-03-10T09:00", []),
      );
      assertTrue(permits(minimumGap("P1D"), "2026-03-10T09:00", []));
    });

    it("refuses to answer at all when the history is left out", () => {
      // Given a cap asked about with no `occurrences` on the context.
      const error = assertThrowsError(() =>
        isActiveAt(
          atMostOccurrences(1, { per: "day" }),
          when("2026-03-10T09:00"),
        ),
      );

      // Then it throws rather than answering. Absent and empty mean different
      // things, and treating a forgotten history as an empty one would report
      // a fifth dose as fine because nobody mentioned the four already taken.
      assertInstanceOf(error, MissingOccurrencesError);
      assertStringIncludes(error.message, "occurrences: []");
    });

    it("counts two occurrences at one instant as two", () => {
      // Given two doses recorded at the same minute, and a cap of two a day.
      const history = taken("08:00", "08:00");

      // When another is asked about.
      // Then the day is full. An interval stream would have coalesced these
      // into one covered minute, and the count is the whole question, which
      // is why a history is a plain array and never a stream.
      assertFalse(
        permits(
          atMostOccurrences(2, { per: "day" }),
          "2026-03-10T18:00",
          history,
        ),
      );
    });
  });

  describe("the zone a bucket is read in", () => {
    it("buckets on the rule's own zone rather than the caller's", () => {
      // Given one visit at ten at night in London, which is already seven the
      // next morning in Tokyo, and a cap of one a day written both ways.
      const history = [{ at: when("2026-03-10T22:00") }];
      const perTokyoDay = atMostOccurrences(1, {
        per: "day",
        zone: "Asia/Tokyo",
      });
      const perLondonDay = atMostOccurrences(1, { per: "day" });

      // When two London afternoons are asked about.
      // Then the two rules disagree about both of them, and the zone is the
      // only difference between them. The 10th is spent in London and free in
      // Tokyo, and the 11th is the other way round.
      assertTrue(permits(perTokyoDay, "2026-03-10T14:00", history));
      assertFalse(permits(perLondonDay, "2026-03-10T14:00", history));

      assertFalse(permits(perTokyoDay, "2026-03-11T14:00", history));
      assertTrue(permits(perLondonDay, "2026-03-11T14:00", history));
    });
  });

  describe("composing with the rest of the language", () => {
    it("narrows a calendar rule the way any other rule does", () => {
      // Given weekdays, capped at one a day.
      const rule = all(weekdays(), atMostOccurrences(1, { per: "day" }));
      const history = [{ at: when("2026-03-10T09:00") }];

      // When a used-up Tuesday, a free Wednesday and a free Sunday are asked
      // about.
      // Then both conditions have to hold.
      assertFalse(permits(rule, "2026-03-10T14:00", history));
      assertTrue(permits(rule, "2026-03-11T14:00", history));
      assertFalse(permits(rule, "2026-03-15T14:00", history));
    });
  });

  describe("the account it gives", () => {
    it("names how many it counted and how many are allowed", () => {
      // Given a full day of doses.
      const explanation = explainRule(
        atMostOccurrences(4, { within: "PT24H" }),
        when("2026-03-10T21:00"),
        { occurrences: taken("08:00", "12:00", "16:00", "20:00") },
      );

      // Then the account says what was counted. This is the reason a
      // constraint is a rule the library knows rather than a custom one. A
      // custom rule could only give its own name back.
      assertFalse(explanation.status === "matched");
      assertIdentical(
        explanation.description,
        "There are already 4 occurrences in the 24 hours up to this instant, " +
          "which is the most allowed.",
      );
    });

    it("says how far the nearest occurrence is", () => {
      // Given one dose an hour ago and a four-hour gap.
      const explanation = explainRule(
        minimumGap("PT4H"),
        when("2026-03-10T13:00"),
        { occurrences: taken("12:00") },
      );

      // Then the account gives the distance in words rather than as an ISO
      // duration, and says what was required.
      assertIdentical(
        explanation.description,
        "The nearest occurrence is 1 hour away, which is closer than the " +
          "4 hours allowed.",
      );
    });

    it("names the bucket it counted in", () => {
      // Given two visits filling a week, a month and a year at once.
      const history = taken("08:00", "20:00");
      const account = (per: "day" | "week" | "month" | "year"): string =>
        explainRule(atMostOccurrences(2, { per }), when("2026-03-10T22:00"), {
          occurrences: history,
        }).description;

      // Then each cap says which bucket it counted, in the singular. The
      // count comes from the same function the evaluator buckets with, so an
      // account can never describe a rule nobody is evaluating.
      assertStringIncludes(account("day"), "in this day");
      assertStringIncludes(account("week"), "in this week");
      assertStringIncludes(account("month"), "in this month");
      assertStringIncludes(account("year"), "in this year");
    });

    it("reads a window as the document wrote it", () => {
      // Given a rolling day, written as twenty-four hours.
      const account = explainRule(
        atMostOccurrences(2, { within: "PT24H" }),
        when("2026-03-10T22:00"),
        {
          occurrences: taken("08:00", "20:00"),
        },
      ).description;

      // Then it says twenty-four hours rather than one day. A rolling window
      // and a calendar day are the two things this rule keeps apart, and
      // balancing the one into the words of the other would undo that.
      assertStringIncludes(account, "24 hours");
    });

    it("balances a distance it measured itself", () => {
      // Given a month's spacing and an occurrence a long way off.
      const account = explainRule(minimumGap("P1M"), when("2026-04-12T20:00"), {
        occurrences: taken("20:00"),
      }).description;

      // Then the distance is in days rather than the hundreds of hours the
      // subtraction produced, while the rule's own month stays a month.
      assertStringIncludes(account, "days");
      assertStringIncludes(account, "1 month is the least allowed");
    });

    it("counts one occurrence in the singular", () => {
      // Given a single visit against a cap of two.
      const account = explainRule(
        atMostOccurrences(2, { per: "day" }),
        when("2026-03-10T09:00"),
        {
          occurrences: taken("08:00"),
        },
      ).description;

      // Then the sentence agrees with itself.
      assertIdentical(
        account,
        "There is 1 occurrence in this day, and at most 2 are allowed.",
      );
    });

    it("says nothing is any distance away at the very instant", () => {
      // Given a dose and the exact instant it was taken.
      const account = explainRule(
        minimumGap("PT4H"),
        when("2026-03-10T12:00"),
        {
          occurrences: taken("12:00"),
        },
      ).description;

      // Then the distance is nothing rather than an empty phrase.
      assertStringIncludes(account, "no time away");
    });

    it("measures to an occurrence still ahead of the instant", () => {
      // Given a dose booked for noon, asked about at six in the morning.
      const account = explainRule(
        minimumGap("PT4H"),
        when("2026-03-10T06:00"),
        {
          occurrences: taken("12:00"),
        },
      ).description;

      // Then the distance is measured forwards. A spacing reads both ways
      // round, and so does the account of it.
      assertStringIncludes(account, "6 hours away");
    });

    it("calls an instant inside an occurrence no distance from it", () => {
      // Given a shift running from nine until noon, and an instant during it.
      // A second occurrence sits a real two and a half hours away.
      const history = [
        {
          at: when("2026-03-10T09:00"),
          lasting: Temporal.Duration.from({ hours: 3 }),
        },
        { at: when("2026-03-10T12:30") },
      ];

      const account = explainRule(
        minimumGap("PT1H"),
        when("2026-03-10T10:00"),
        {
          occurrences: history,
        },
      ).description;

      // Then the distance is nothing. Measuring back to where the shift began
      // would give a negative duration, and a negative one sorts below every
      // real gap, so the account would pick this occurrence over the nearer
      // one and then report the distance as though it were positive.
      assertStringIncludes(account, "no time away");
    });

    it("reads a distance shorter than a second", () => {
      // Given half a second between two events.
      const account = explainRule(
        minimumGap("PT0.5S"),
        when("2026-03-10T09:00:01.9"),
        { occurrences: [{ at: when("2026-03-10T09:00:01.7") }] },
      ).description;

      // Then it is said in milliseconds rather than rounded away to nothing.
      assertStringIncludes(account, "200 milliseconds");
      assertStringIncludes(account, "500 milliseconds");
    });

    it("says so when nothing has happened", () => {
      // Given a spacing and an empty history.
      const explanation = explainRule(
        minimumGap("PT4H"),
        when("2026-03-10T13:00"),
        {
          occurrences: [],
        },
      );

      // Then it says why it matched rather than reporting a distance it does
      // not have.
      assertTrue(explanation.status === "matched");
      assertStringIncludes(explanation.description, "Nothing has happened yet");
    });
  });

  describe("a window written in calendar units", () => {
    it("counts a day to the same clock time rather than to the same length", () => {
      // Given one visit at noon the day the clocks go forward in London, and
      // the same cap written as a day and as twenty-four hours.
      const history = [{ at: when("2026-03-28T12:00") }];

      // When noon the next day is asked about, which is twenty-three real
      // hours later because an hour went missing overnight.
      // Then the calendar day has passed and the twenty-four hours have not.
      // Both readings are wanted: a Schengen window is written in days and a
      // rate limit is written in real time.
      assertTrue(
        permits(
          atMostOccurrences(1, { within: "P1D" }),
          "2026-03-29T12:00",
          history,
        ),
      );
      assertFalse(
        permits(
          atMostOccurrences(1, { within: "PT24H" }),
          "2026-03-29T12:00",
          history,
        ),
      );
    });
  });

  describe("the document it stores as", () => {
    it("survives a JSON round trip", () => {
      // Given both constraints together.
      const written = JSON.stringify(
        all(atMostOccurrences(4, { within: "PT24H" }), minimumGap("PT4H")),
      );

      // When stored and read back.
      // Then nothing has moved.
      const restored = parseRule(JSON.parse(written));
      assertIdentical(JSON.stringify(restored), written);
      assertStringIncludes(
        written,
        '{"type":"atMost","count":4,"within":"PT24H"}',
      );
    });

    it("keeps the two kinds of window in separate fields", () => {
      // Given the same count written both ways.
      // When each is built.
      // Then the builder reads the shape of the word and the document says
      // which was meant, so nothing downstream has to guess.
      assertStringIncludes(
        JSON.stringify(atMostOccurrences(4, { per: "day" })),
        '"per":"days"',
      );
      assertStringIncludes(
        JSON.stringify(atMostOccurrences(4, { within: "PT24H" })),
        '"within":"PT24H"',
      );
    });

    it("compares equal however the duration is cased", () => {
      // Given one gap written twice.
      // When the two are compared.
      // Then they are the same rule.
      assertTrue(sameDefinition(minimumGap("PT4H"), minimumGap("pt4h")));
    });

    it("keeps two durations apart when balancing them needs a calendar", () => {
      // Given an hour written as sixty minutes.
      // When the two are compared.
      // Then they differ. Canonical form is syntactic everywhere else for the
      // same reason, and a duration holding months cannot be balanced at all.
      assertFalse(sameDefinition(minimumGap("PT60M"), minimumGap("PT1H")));
    });

    it("sorts beside the other rules in canonical form", () => {
      // Given a cap written after the days it applies to.
      // When it is canonicalised.
      // Then the operands are ordered the one way, as they are for any `all`.
      const capFirst = canonical(
        all(atMostOccurrences(1, { per: "day" }), weekdays()),
      );
      const daysFirst = canonical(
        all(weekdays(), atMostOccurrences(1, { per: "day" })),
      );
      assertIdentical(JSON.stringify(daysFirst), JSON.stringify(capFirst));
    });
  });

  describe("what it refuses to be written as", () => {
    it("refuses a cap naming both kinds of window", () => {
      // Given a document with `per` and `within` both set.
      const error = assertThrowsError(() =>
        parseRule({ type: "atMost", count: 2, per: "days", within: "PT1H" }),
      );

      // Then it is refused. The two say different things and picking one
      // would be a guess about which was meant.
      assertStringIncludes(error.message, "names both");
    });

    it("refuses a cap naming neither", () => {
      // Given a document with no window at all.
      const error = assertThrowsError(() =>
        parseRule({ type: "atMost", count: 2 }),
      );

      // Then it is refused, with both forms that would have worked.
      assertStringIncludes(error.message, "needs a window");
    });

    it("refuses a cap of nothing, and names the rule that says it", () => {
      // Given a cap of zero.
      const error = assertThrowsError(() =>
        atMostOccurrences(0, { per: "day" }),
      );

      // Then it is refused rather than quietly meaning `never()`.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, "never()");
    });

    it("refuses a gap that runs backwards", () => {
      // Given a negative spacing.
      const error = assertThrowsError(() => minimumGap("-PT4H"));

      // Then it is refused rather than read as its own opposite.
      assertStringIncludes(error.message, "runs backwards");
    });

    it("refuses a gap that is not a length of time", () => {
      // Given a spacing written the way it is said.
      const error = assertThrowsError(() => minimumGap("four hours"));

      // Then it is refused, with the form that would have worked.
      assertStringIncludes(error.message, '"PT4H"');
    });

    it("refuses fields of the wrong type in a document", () => {
      // Given a count and a period arriving as the wrong kind of thing.
      for (const [document, field] of [
        [{ type: "atMost", count: "2", per: "days" }, "rule.count"],
        [{ type: "atMost", count: 2, per: 3 }, "rule.per"],
        [{ type: "spacedBy", gap: 4 }, "rule.gap"],
      ] as const) {
        const error = assertThrowsError(() => parseRule(document));
        assertStringIncludes(error.message, field);
      }
    });

    it("refuses a gap of no time", () => {
      // Given a spacing of zero.
      const error = assertThrowsError(() => minimumGap("PT0S"));

      // Then it is refused. A spacing of nothing spaces nothing, which is a
      // quiet way of writing a rule that does not constrain.
      assertStringIncludes(error.message, "no time at all");
    });

    it("cannot be written as cron or a recurrence, and says why", () => {
      // Given a cap written as cron.
      const written = toCron(atMostOccurrences(4, { within: "PT24H" }));

      // Then it is refused, and the reason is the history rather than the
      // shape. Neither notation has anywhere to carry one.
      assertFalse(written.ok);
      assertStringIncludes(written.reason, "already happened");
    });
  });
});
