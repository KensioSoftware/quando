import { dailyForever, metered, render, span } from "#test/intervals.js";
import {
  assertArrayLength,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { difference } from "./interval-difference.js";
import { clip, complement, intersect, union } from "./interval-stream.js";
import { duration } from "./interval.js";
import { take } from "./stream.js";

describe("the interval algebra", () => {
  const MARCH = span("2026-03-01T00:00", "2026-04-01T00:00");

  describe("intersect", () => {
    it("keeps only the overlap", () => {
      // Given a working day and an afternoon-to-evening shift.
      const workday = [span("2026-03-16T09:00", "2026-03-16T17:00")];
      const shift = [span("2026-03-16T12:00", "2026-03-16T20:00")];

      // When they are intersected.
      // Then the five hours they share come back.
      assertIdentical(
        render(intersect(workday, shift)),
        "[2026-03-16T12:00:00,2026-03-16T17:00:00)",
      );
    });

    it("yields nothing for disjoint streams", () => {
      // Given a morning and an afternoon with an hour between them.
      const morning = [span("2026-03-16T09:00", "2026-03-16T12:00")];
      const afternoon = [span("2026-03-16T13:00", "2026-03-16T17:00")];

      // When they are intersected.
      // Then nothing comes back.
      assertIdentical(render(intersect(morning, afternoon)), "");
    });

    it("yields nothing for merely touching streams, since intervals are half open", () => {
      // Given a morning and an afternoon that meet exactly at noon.
      const morning = [span("2026-03-16T09:00", "2026-03-16T12:00")];
      const afternoon = [span("2026-03-16T12:00", "2026-03-16T17:00")];

      // When they are intersected.
      // Then nothing comes back. Noon belongs to the afternoon alone, and a
      // zero-length overlap is no overlap.
      assertIdentical(render(intersect(morning, afternoon)), "");
    });

    it("matches one long interval against several short ones", () => {
      // Given two days as one stretch, against three separate working days, the
      // last of which falls outside.
      const twoDays = [span("2026-03-16T00:00", "2026-03-18T00:00")];
      const workdays = [
        span("2026-03-16T09:00", "2026-03-16T17:00"),
        span("2026-03-17T09:00", "2026-03-17T17:00"),
        span("2026-03-19T09:00", "2026-03-19T17:00"),
      ];

      // When they are intersected.
      // Then the two inside come through and the third is dropped, with one
      // long interval matched against many short ones in a single pass.
      assertIdentical(
        render(intersect(twoDays, workdays)),
        "[2026-03-16T09:00:00,2026-03-16T17:00:00) [2026-03-17T09:00:00,2026-03-17T17:00:00)",
      );
    });

    it("treats an unbounded stream as covering everything", () => {
      // Given all of time and one working day.
      const everything = [span(undefined, undefined)];
      const workday = [span("2026-03-16T09:00", "2026-03-16T17:00")];

      // When they are intersected.
      // Then the day comes back untouched.
      assertIdentical(
        render(intersect(everything, workday)),
        "[2026-03-16T09:00:00,2026-03-16T17:00:00)",
      );
    });

    it("terminates on an empty result once its sources are bounded", () => {
      // Given mornings and evenings that recur forever and never meet, each
      // clipped to a month. Unbounded, this sweep would run on: there is
      // nothing either side could inspect to learn the answer is empty.
      const mornings = clip(
        dailyForever("2026-03-01", "09:00", "12:00"),
        MARCH,
      );
      const evenings = clip(
        dailyForever("2026-03-01", "18:00", "21:00"),
        MARCH,
      );

      // When they are intersected.
      // Then it finishes with nothing. Clipping is what makes the inputs run
      // out, and the sweep above them with it.
      assertIdentical(render(intersect(mornings, evenings)), "");
    });
  });

  describe("union", () => {
    it("merges overlapping intervals", () => {
      // Given a morning and an afternoon that overlap by an hour.
      const morning = [span("2026-03-16T09:00", "2026-03-16T13:00")];
      const afternoon = [span("2026-03-16T12:00", "2026-03-16T17:00")];

      // When they are unioned.
      // Then one stretch covers both.
      assertIdentical(
        render(union(morning, afternoon)),
        "[2026-03-16T09:00:00,2026-03-16T17:00:00)",
      );
    });

    it("merges merely touching intervals, so the output stays coalesced", () => {
      // Given a morning and an afternoon meeting exactly at noon.
      const morning = [span("2026-03-16T09:00", "2026-03-16T12:00")];
      const afternoon = [span("2026-03-16T12:00", "2026-03-16T17:00")];

      // When they are unioned.
      // Then they come back as one. Correct as a set either way, but a touching
      // pair breaks the contract the other sweeps read each other under.
      assertIdentical(
        render(union(morning, afternoon)),
        "[2026-03-16T09:00:00,2026-03-16T17:00:00)",
      );
    });

    it("keeps disjoint intervals apart and in order", () => {
      // Given a morning and an afternoon with a gap between them.
      const morning = [span("2026-03-16T09:00", "2026-03-16T12:00")];
      const afternoon = [span("2026-03-16T13:00", "2026-03-16T17:00")];

      // When they are unioned.
      // Then both come back, ascending, with the gap intact.
      assertIdentical(
        render(union(morning, afternoon)),
        "[2026-03-16T09:00:00,2026-03-16T12:00:00) [2026-03-16T13:00:00,2026-03-16T17:00:00)",
      );
    });

    it("drains whichever side outlasts the other", () => {
      // Given one early interval on the left and two later ones on the right.
      const early = [span("2026-03-16T09:00", "2026-03-16T10:00")];
      const later = [
        span("2026-03-16T11:00", "2026-03-16T12:00"),
        span("2026-03-16T13:00", "2026-03-16T14:00"),
      ];

      // When they are unioned.
      // Then all three arrive. The side that runs out first does not end the
      // sweep.
      assertIdentical(
        render(union(early, later)),
        "[2026-03-16T09:00:00,2026-03-16T10:00:00) " +
          "[2026-03-16T11:00:00,2026-03-16T12:00:00) " +
          "[2026-03-16T13:00:00,2026-03-16T14:00:00)",
      );
    });

    it("absorbs everything into an unbounded interval", () => {
      // Given an interval that never ends, and a later day inside it.
      const open = [span("2026-03-16T09:00", undefined)];
      const later = [span("2026-03-20T09:00", "2026-03-20T17:00")];

      // When they are unioned.
      // Then the open interval swallows the day.
      assertIdentical(render(union(open, later)), "[2026-03-16T09:00:00,*)");
    });

    it("takes from the right when it leads, and keeps draining it", () => {
      // Given a left side that starts after both intervals on the right.
      const afternoon = [span("2026-03-16T15:00", "2026-03-16T16:00")];
      const mornings = [
        span("2026-03-16T09:00", "2026-03-16T10:00"),
        span("2026-03-16T11:00", "2026-03-16T12:00"),
      ];

      // When they are unioned.
      // Then the output is still ascending. The sweep takes from whichever side
      // leads, whichever argument it arrived as.
      assertIdentical(
        render(union(afternoon, mornings)),
        "[2026-03-16T09:00:00,2026-03-16T10:00:00) " +
          "[2026-03-16T11:00:00,2026-03-16T12:00:00) " +
          "[2026-03-16T15:00:00,2026-03-16T16:00:00)",
      );
    });

    it("stops as soon as it opens onto the unbounded future", () => {
      // Given an interval that runs forever, against a daily recurrence that
      // also never ends.
      const forever = [span("2026-03-01T00:00", undefined)];
      const daily = dailyForever("2026-03-01", "09:00", "17:00");

      // When one interval is taken from the union.
      const merged = take(union(forever, daily), 1);

      // Then it arrives. Nothing can extend an interval that already runs to
      // the unbounded future, and a sweep that kept pulling here would never
      // yield at all.
      assertIdentical(render(merged), "[2026-03-01T00:00:00,*)");
    });

    it("is empty for two empty streams", () => {
      // Given two streams with nothing in them.
      // When they are unioned.
      // Then nothing comes back.
      assertIdentical(render(union([], [])), "");
    });
  });

  describe("difference", () => {
    it("removes overlapping intervals from the left stream", () => {
      // Given a working day with lunch and the late afternoon excluded.
      const workday = [span("2026-03-16T09:00", "2026-03-16T17:00")];
      const excluded = [
        span("2026-03-16T12:00", "2026-03-16T13:00"),
        span("2026-03-16T15:00", "2026-03-16T18:00"),
      ];

      // When the exclusions are subtracted.
      const remaining = difference(workday, excluded);

      // Then the uncovered morning and afternoon remain.
      assertIdentical(
        render(remaining),
        "[2026-03-16T09:00:00,2026-03-16T12:00:00) " +
          "[2026-03-16T13:00:00,2026-03-16T15:00:00)",
      );
    });

    it("keeps an unbounded end outside the excluded interval", () => {
      // Given all time after nine with one hour excluded.
      const afterNine = [span("2026-03-16T09:00", undefined)];
      const excluded = [span("2026-03-16T12:00", "2026-03-16T13:00")];

      // When the exclusion is subtracted.
      const remaining = difference(afterNine, excluded);

      // Then both sides keep their original outer bounds.
      assertIdentical(
        render(remaining),
        "[2026-03-16T09:00:00,2026-03-16T12:00:00) " +
          "[2026-03-16T13:00:00,*)",
      );
    });
  });

  describe("complement", () => {
    it("returns the gaps, unbounded at both ends", () => {
      // Given two working days.
      const covered = [
        span("2026-03-16T09:00", "2026-03-16T17:00"),
        span("2026-03-17T09:00", "2026-03-17T17:00"),
      ];

      // When the complement is taken.
      // Then the night between them comes back, along with everything before
      // the first day and after the last.
      assertIdentical(
        render(complement(covered)),
        "[*,2026-03-16T09:00:00) " +
          "[2026-03-16T17:00:00,2026-03-17T09:00:00) " +
          "[2026-03-17T17:00:00,*)",
      );
    });

    it("has nothing before a source that begins at the unbounded past", () => {
      // Given a source already open at its start.
      const covered = [span(undefined, "2026-03-16T09:00")];

      // When the complement is taken.
      // Then only the stretch after it comes back. There is nothing before the
      // unbounded past to report.
      assertIdentical(render(complement(covered)), "[2026-03-16T09:00:00,*)");
    });

    it("has nothing after a source that runs to the unbounded future", () => {
      // Given a source already open at its end.
      const covered = [span("2026-03-16T09:00", undefined)];

      // When the complement is taken.
      // Then only the stretch before it comes back.
      assertIdentical(render(complement(covered)), "[*,2026-03-16T09:00:00)");
    });

    it("is everything for an empty source", () => {
      // Given a source covering no time.
      // When the complement is taken.
      // Then all of time comes back.
      assertIdentical(render(complement([])), "[*,*)");
    });

    it("is nothing for a source that covers everything", () => {
      // Given a source covering all of time.
      // When the complement is taken.
      // Then nothing comes back.
      const everything = [span(undefined, undefined)];

      assertIdentical(render(complement(everything)), "");
    });

    it("ignores zero-length intervals rather than splitting a gap around them", () => {
      // Given a source holding one interval that covers no time.
      const withEmpty = [span("2026-03-16T09:00", "2026-03-16T09:00")];

      // When the complement is taken.
      // Then all of time comes back as one interval. Letting the empty one
      // through would split the gap into a touching pair, which is a stream
      // these sweeps read wrongly.
      assertIdentical(render(complement(withEmpty)), "[*,*)");
    });

    it("round-trips when applied twice", () => {
      // Given two working days.
      const covered = [
        span("2026-03-16T09:00", "2026-03-16T17:00"),
        span("2026-03-17T09:00", "2026-03-17T17:00"),
      ];

      // When the complement of the complement is taken.
      // Then the original comes back.
      const gaps = complement(covered);

      assertIdentical(render(complement(gaps)), render(covered));
    });
  });

  describe("clip", () => {
    it("trims intervals to the window", () => {
      // Given four days as one stretch, and a one-day window inside it.
      const source = [span("2026-03-16T00:00", "2026-03-20T00:00")];
      const window = span("2026-03-17T00:00", "2026-03-18T00:00");

      // When it is clipped.
      // Then the stretch comes back cut to the window.
      assertIdentical(
        render(clip(source, window)),
        "[2026-03-17T00:00:00,2026-03-18T00:00:00)",
      );
    });

    it("drops intervals outside the window entirely", () => {
      // Given three days, with only the middle one inside the window.
      const source = [
        span("2026-03-01T09:00", "2026-03-01T17:00"),
        span("2026-03-17T09:00", "2026-03-17T17:00"),
        span("2026-03-30T09:00", "2026-03-30T17:00"),
      ];
      const window = span("2026-03-10T00:00", "2026-03-20T00:00");

      // When it is clipped.
      // Then the one inside comes back and the others are gone.
      assertIdentical(
        render(clip(source, window)),
        "[2026-03-17T09:00:00,2026-03-17T17:00:00)",
      );
    });

    it("stops early rather than draining an infinite source", () => {
      // Given a recurrence with no end, and a window three days wide. The meter
      // counts how far the source is consumed, which is the only way to observe
      // laziness from outside.
      const meter = metered(dailyForever("2026-03-01", "09:00", "17:00"));
      const window = span("2026-03-01T00:00", "2026-03-04T00:00");

      // When the whole clipped stream is drained.
      const clipped = [...clip(meter.stream, window)];

      // Then three days come back, and the source gave up four: the three
      // results, plus the one that proved the window was behind it.
      assertArrayLength(clipped, 3);
      assertIdentical(meter.pulled(), 4);
    });

    it("passes everything through an unbounded window", () => {
      // Given a working day and a window covering all of time.
      const source = [span("2026-03-16T09:00", "2026-03-16T17:00")];

      // When it is clipped.
      // Then the day comes through untouched.
      const everywhen = span(undefined, undefined);

      assertIdentical(
        render(clip(source, everywhen)),
        "[2026-03-16T09:00:00,2026-03-16T17:00:00)",
      );
    });
  });

  describe("take, over intervals", () => {
    const twoDays = () => [
      span("2026-03-16T09:00", "2026-03-16T17:00"),
      span("2026-03-17T09:00", "2026-03-17T17:00"),
    ];

    it("takes nothing for a count of zero or less", () => {
      // Given two days.
      // When zero or fewer is asked for.
      // Then nothing comes back.
      assertArrayLength(take(twoDays(), 0), 0);
      assertArrayLength(take(twoDays(), -1), 0);
    });

    it("takes fewer than asked when the source is short", () => {
      // Given two days.
      // When ten are asked for.
      // Then two come back, without complaint.
      assertArrayLength(take(twoDays(), 10), 2);
    });

    it("takes exactly the count asked", () => {
      // Given two days.
      // When one is asked for.
      // Then one comes back.
      assertArrayLength(take(twoDays(), 1), 1);
    });
  });

  describe("laziness", () => {
    it("pulls barely more than it yields from an infinite intersection", () => {
      // Given a daily recurrence with no end, intersected against a year.
      // Counting pulls is the assertion here on purpose: laziness is behaviour,
      // and how far a source was consumed is the only way to see it. Sampling
      // this window would take hundreds of steps.
      const meter = metered(dailyForever("2026-03-01", "09:00", "17:00"));
      const year = [span("2026-03-01T00:00", "2027-01-01T00:00")];

      // When three intervals are taken.
      const taken = take(intersect(meter.stream, year), 3);

      // Then three arrive, and the source was barely touched.
      assertArrayLength(taken, 3);
      assertTrue(meter.pulled() <= 4);
    });

    it("does not expand an infinite source to complement it", () => {
      // Given the same endless recurrence.
      const meter = metered(dailyForever("2026-03-01", "09:00", "17:00"));

      // When two gaps are taken from its complement.
      const gaps = take(complement(meter.stream), 2);

      // Then they arrive off the front of the source, with no expansion.
      assertArrayLength(gaps, 2);
      assertTrue(meter.pulled() <= 3);
    });
  });

  describe("composition over a daylight saving transition", () => {
    it("keeps wall-clock hours while measuring exact elapsed time", () => {
      // Given four days of office hours across the weekend London loses an
      // hour. The change falls at 01:00, outside the working day.
      const week = span("2026-03-27T00:00", "2026-03-31T00:00");

      // When the recurrence is clipped to that week and each day measured.
      const hours = [
        ...clip(dailyForever("2026-03-27", "09:00", "17:00"), week),
      ];

      // Then all four days are eight hours long, including the one whose
      // calendar day held only 23.
      assertArrayLength(hours, 4);
      for (const day of hours) {
        assertIdentical(duration(day)?.toString(), "PT8H");
      }
    });

    it("reports exact elapsed time for an interval spanning the transition", () => {
      // Given an overnight window and a maintenance window that overlap across
      // the missing hour.
      const overnight = [span("2026-03-29T00:00", "2026-03-29T06:00")];
      const maintenance = [span("2026-03-28T22:00", "2026-03-29T12:00")];

      // When the overlap is measured.
      const overlap = [...intersect(overnight, maintenance)];

      // Then six hours of clock face is five hours of elapsed time.
      assertArrayLength(overlap, 1);
      assertIdentical(duration(overlap[0])?.toString(), "PT5H");
    });
  });
});
