import { inWindow, render, when } from "#test/intervals.js";
import {
  assertArrayEmpty,
  assertIdentical,
  assertLessThan,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { dates } from "./build.js";
import { intervals } from "./interpret.js";
import { parseRule } from "./parse.js";
import { activeAt } from "./query.js";
import type { Rule } from "./rule.js";

describe("naming days by date", () => {
  /** The days a rule covers in a window, as one readable line. */
  const covered = (
    days: readonly string[],
    from: string,
    to?: string,
  ): string => render(intervals(dates(...days), inWindow(from, to)));

  describe("the window it starts at", () => {
    it("keeps a run that began before the window", () => {
      // Given three days in a row, and a window opening on the middle one.
      // When the rule is read.
      // Then the run comes back clipped to the window rather than skipped for
      // having started outside it.
      assertIdentical(
        covered(
          ["2026-06-15", "2026-06-16", "2026-06-17"],
          "2026-06-16T00:00",
          "2026-06-20T00:00",
        ),
        "[2026-06-16T00:00:00,2026-06-18T00:00:00)",
      );
    });

    it("keeps a day the window opens partway through", () => {
      // Given one day, and a window opening at lunchtime on it.
      // When the rule is read.
      // Then the afternoon comes back. A day is covered from midnight, and the
      // window is what trims it.
      assertIdentical(
        covered(["2026-06-15"], "2026-06-15T12:00", "2026-06-20T00:00"),
        "[2026-06-15T12:00:00,2026-06-16T00:00:00)",
      );
    });

    it("drops a day that ends exactly as the window opens", () => {
      // Given a day, and a window opening at the midnight it ends on.
      // When the rule is read.
      // Then nothing comes back. Intervals are half-open, so the two touch
      // without overlapping.
      assertArrayEmpty([
        ...intervals(
          dates("2026-06-15"),
          inWindow("2026-06-16T00:00", "2026-06-20T00:00"),
        ),
      ]);
    });

    it("keeps a day the window ends partway through", () => {
      // Given one day, and a window closing at lunchtime on it.
      // When the rule is read.
      // Then the morning comes back, so the last day is not lost to the seek.
      assertIdentical(
        covered(["2026-06-15"], "2026-06-10T00:00", "2026-06-15T12:00"),
        "[2026-06-15T00:00:00,2026-06-15T12:00:00)",
      );
    });

    it("finds a day surrounded by dates on both sides", () => {
      // Given dates spread over years, and a window holding one of them.
      // When the rule is read.
      // Then that one comes back, and the ones on either side stay out.
      assertIdentical(
        covered(
          ["2020-01-01", "2023-06-15", "2026-12-25"],
          "2023-01-01T00:00",
          "2024-01-01T00:00",
        ),
        "[2023-06-15T00:00:00,2023-06-16T00:00:00)",
      );
    });

    it("covers no time when every date is behind the window", () => {
      // Given dates that all fall before the window opens.
      // When the rule is read.
      // Then it covers nothing.
      assertArrayEmpty([
        ...intervals(
          dates("2020-01-01", "2020-01-02"),
          inWindow("2026-01-01T00:00", "2027-01-01T00:00"),
        ),
      ]);
    });

    it("covers no time when every date is ahead of the window", () => {
      // Given dates that all fall after the window closes.
      // When the rule is read.
      // Then it covers nothing.
      assertArrayEmpty([
        ...intervals(
          dates("2030-01-01", "2030-01-02"),
          inWindow("2026-01-01T00:00", "2027-01-01T00:00"),
        ),
      ]);
    });

    it("runs to the end of an unbounded window", () => {
      // Given two dates and a window with no end.
      // When the rule is read.
      // Then both come back. Nothing bounds the search but the dates running
      // out, which they do.
      assertIdentical(
        covered(["2026-06-15", "2026-08-20"], "2026-01-01T00:00"),
        "[2026-06-15T00:00:00,2026-06-16T00:00:00) " +
          "[2026-08-20T00:00:00,2026-08-21T00:00:00)",
      );
    });
  });

  describe("the forms a date can be written in", () => {
    it("reads a date however the document spells it", () => {
      // Given one day written four ways `Temporal` accepts, in no order. A
      // stored document keeps what it was given, so all four reach the
      // evaluator as written.
      const spellings = [
        "2026-06-17",
        "20260615",
        "+002026-06-16",
        "2026-06-14T10:00",
      ];

      // When the rule is read over a window holding all of them.
      // Then they sort and coalesce into the one run of four days they name.
      assertIdentical(
        covered(spellings, "2026-06-01T00:00", "2026-07-01T00:00"),
        "[2026-06-14T00:00:00,2026-06-18T00:00:00)",
      );
    });

    it("counts one day once however many ways it is written", () => {
      // Given the same day written twice.
      // When the rule is read.
      // Then it covers that day once.
      assertIdentical(
        covered(
          ["2026-06-15", "20260615"],
          "2026-06-01T00:00",
          "2026-07-01T00:00",
        ),
        "[2026-06-15T00:00:00,2026-06-16T00:00:00)",
      );
    });
  });

  describe("the zone the dates are read in", () => {
    /**
     * A stored `dates` rule carrying its own zone. The leaf field is the case
     * the seek has to get right: an `inZone` wrapper moves the window into the
     * same zone first, so there the two agree whatever the seek reads.
     */
    const on = (zone: string, ...days: readonly string[]): Rule =>
      parseRule({ type: "dates", dates: days, zone });

    it("seeks on the rule's zone when it lags the caller's", () => {
      // Given a day in Los Angeles, which is still running there while London
      // has gone past midnight into the day after.
      const rule = on("America/Los_Angeles", "2026-06-15");

      // When it is asked about from one in the morning, London time.
      const found = intervals(
        rule,
        inWindow("2026-06-16T01:00", "2026-06-17T00:00"),
      );

      // Then the rest of the Los Angeles day comes back. Seeking on the London
      // date would have looked for a day ending after the 16th and skipped
      // this one, which ends on it.
      assertIdentical(
        render(found),
        "[2026-06-16T01:00:00,2026-06-16T08:00:00)",
      );
    });

    it("stops on the rule's zone when it leads the caller's", () => {
      // Given a day in Tokyo, which starts on the London afternoon before.
      const rule = on("Asia/Tokyo", "2026-06-16");

      // When it is asked about a London window closing that same afternoon.
      const found = intervals(
        rule,
        inWindow("2026-06-15T00:00", "2026-06-15T17:00"),
      );

      // Then the hour of it inside the window comes back. Stopping on the
      // London date would have called the day ahead of the window and
      // returned before reaching it.
      assertIdentical(
        render(found),
        "[2026-06-15T16:00:00,2026-06-15T17:00:00)",
      );
    });
  });

  describe("what a point query costs", () => {
    /** Dates every third day from 2000, as a long holiday list would run. */
    const spread = (count: number): string[] => {
      const start = Temporal.PlainDate.from("2000-01-01");
      return Array.from({ length: count }, (_, index) =>
        start.add({ days: index * 3 }).toString(),
      );
    };

    /**
     * The best of three runs of the same point query, in microseconds.
     *
     * Best of three rather than the mean, because a garbage collection landing
     * in one run is what a mean would carry into the ratio. The first run is
     * thrown away, so the reading a rule does once has happened before the
     * timing starts.
     */
    const cost = (days: readonly string[]): number => {
      const rule = dates(...days);
      const at = when("2026-06-15T10:00");
      const runs = 1000;
      const once = (): number => {
        const started = performance.now();
        for (let n = 0; n < runs; n++) {
          activeAt(rule, at);
        }
        return ((performance.now() - started) / runs) * 1000;
      };
      once();
      return Math.min(once(), once(), once());
    };

    it("stays the same as the list of dates grows", () => {
      // Given a short list of dates and a long one, both asked the same
      // question at the same instant.
      const short = cost(spread(100));
      const long = cost(spread(4000));

      // Then forty times the dates costs about the same. Reading the dates is
      // the expensive part and it happens once, and the seek goes to the
      // window rather than walking there. Before both, this ratio was about
      // thirty. The bar is set well above the noise and well below that.
      assertTrue(long > 0);
      assertLessThan(long / short, 8);
    });
  });
});
