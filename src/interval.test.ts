import { span, when } from "#test/intervals.js";
import {
  assertFalse,
  assertIdentical,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  compareEnds,
  compareStarts,
  contains,
  duration,
  earlierEnd,
  earlierStart,
  isEmpty,
  laterEnd,
  laterStart,
  startsAtOrBeforeEnd,
  startsBeforeEnd,
} from "./interval.js";

describe("intervals and their edges", () => {
  const NINE = when("2026-03-16T09:00");
  const NOON = when("2026-03-16T12:00");
  const FIVE = when("2026-03-16T17:00");

  describe("comparing starts", () => {
    it("treats an absent start as the unbounded past", () => {
      // Given a start that is absent and one that is nine in the morning.
      // When they are compared in either order.
      // Then the absent one sorts first. Nothing precedes the unbounded past.
      assertTrue(compareStarts(undefined, NINE) < 0);
      assertTrue(compareStarts(NINE, undefined) > 0);
    });

    it("considers two unbounded pasts equal", () => {
      // Given two absent starts.
      // When they are compared.
      // Then they tie. Both name the same edge of time.
      assertIdentical(compareStarts(undefined, undefined), 0);
    });

    it("orders two bounded starts by their instants", () => {
      // Given two starts three hours apart.
      // When they are compared, and one is compared with itself.
      // Then the earlier sorts first and the pair ties.
      assertTrue(compareStarts(NINE, NOON) < 0);
      assertIdentical(compareStarts(NINE, NINE), 0);
    });
  });

  describe("comparing ends", () => {
    it("treats an absent end as the unbounded future", () => {
      // Given an end that is absent and one at five in the afternoon.
      // When they are compared in either order.
      // Then the absent one sorts last. This is where an end differs from a
      // start, and why the two comparisons are separate functions.
      assertTrue(compareEnds(undefined, FIVE) > 0);
      assertTrue(compareEnds(FIVE, undefined) < 0);
    });

    it("considers two unbounded futures equal", () => {
      // Given two absent ends.
      // When they are compared.
      // Then they tie.
      assertIdentical(compareEnds(undefined, undefined), 0);
    });

    it("orders two bounded ends by their instants", () => {
      // Given noon and five.
      // When they are compared.
      // Then noon sorts first.
      assertTrue(compareEnds(NOON, FIVE) < 0);
    });
  });

  describe("picking between two edges", () => {
    it("picks the earlier and later start, with unbounded as the earlier", () => {
      // Given pairs of starts, some with an unbounded member.
      // When the earlier and the later of each is taken.
      // Then order of the arguments makes no difference, and an unbounded
      // start is the earlier of any pair it appears in.
      assertIdentical(earlierStart(NINE, NOON), NINE);
      assertIdentical(earlierStart(NOON, NINE), NINE);
      assertUndefined(earlierStart(undefined, NINE));
      assertIdentical(laterStart(NINE, NOON), NOON);
      assertIdentical(laterStart(undefined, NINE), NINE);
    });

    it("picks the earlier and later end, with unbounded as the later", () => {
      // Given pairs of ends, some with an unbounded member.
      // When the earlier and the later of each is taken.
      // Then an unbounded end is the later of any pair it appears in, the
      // mirror of what starts do.
      assertIdentical(earlierEnd(NOON, FIVE), NOON);
      assertIdentical(earlierEnd(FIVE, NOON), NOON);
      assertIdentical(laterEnd(FIVE, NOON), FIVE);
      assertIdentical(earlierEnd(undefined, FIVE), FIVE);
      assertIdentical(laterEnd(NOON, FIVE), FIVE);
      assertUndefined(laterEnd(undefined, FIVE));
    });
  });

  describe("whether a start precedes an end", () => {
    it("is true for an ordinary non-empty interval", () => {
      // Given nine in the morning and five in the afternoon.
      // When the start is tested against the end.
      // Then it precedes it, and the interval holds time.
      assertTrue(startsBeforeEnd(NINE, FIVE));
    });

    it("is false when the two coincide, because intervals are half open", () => {
      // Given one instant used as both edges.
      // When the start is tested against the end.
      // Then it fails. An interval that excludes its end and starts there
      // holds nothing.
      assertFalse(startsBeforeEnd(NINE, NINE));
    });

    it("is false when the start follows the end", () => {
      // Given the edges the wrong way round.
      // When they are tested.
      // Then it fails.
      assertFalse(startsBeforeEnd(FIVE, NINE));
    });

    it("is true whenever either edge is unbounded", () => {
      // Given pairs with an unbounded past, an unbounded future, or both.
      // When each is tested.
      // Then all pass. Nothing precedes the unbounded past and nothing
      // follows the unbounded future.
      assertTrue(startsBeforeEnd(undefined, NINE));
      assertTrue(startsBeforeEnd(FIVE, undefined));
      assertTrue(startsBeforeEnd(undefined, undefined));
    });

    it("separates touching from overlapping", () => {
      // Given noon as both a start and an end, the case of two intervals that
      // meet exactly.
      // When the strict and the inclusive tests are both applied.
      // Then only the inclusive one passes. That gap is what lets a union
      // coalesce a pair that touches without treating it as an overlap.
      assertFalse(startsBeforeEnd(NOON, NOON));
      assertTrue(startsAtOrBeforeEnd(NOON, NOON));
      assertTrue(startsAtOrBeforeEnd(undefined, NOON));
      assertTrue(startsAtOrBeforeEnd(NOON, undefined));
    });
  });

  describe("emptiness", () => {
    it("is empty when the edges coincide", () => {
      // Given an interval from nine to nine.
      // When it is tested.
      // Then it is empty.
      assertTrue(isEmpty(span("2026-03-16T09:00", "2026-03-16T09:00")));
    });

    it("is not empty for an ordinary interval", () => {
      // Given a working day.
      // When it is tested.
      // Then it holds time.
      assertFalse(isEmpty(span("2026-03-16T09:00", "2026-03-16T17:00")));
    });

    it("is not empty when unbounded in either direction", () => {
      // Given an interval open at the start, and one open at the end.
      // When each is tested.
      // Then both hold time.
      assertFalse(isEmpty(span(undefined, "2026-03-16T09:00")));
      assertFalse(isEmpty(span("2026-03-16T09:00", undefined)));
    });
  });

  describe("containment", () => {
    const workday = span("2026-03-16T09:00", "2026-03-16T17:00");

    it("includes the start", () => {
      // Given a working day and the instant it opens.
      // When containment is tested.
      // Then the opening instant is inside.
      assertTrue(contains(workday, NINE));
    });

    it("excludes the end", () => {
      // Given the same day and the instant it closes.
      // When containment is tested.
      // Then closing time is outside. Two adjacent days would otherwise both
      // claim it.
      assertFalse(contains(workday, FIVE));
    });

    it("includes an instant in the middle", () => {
      // Given noon.
      // When containment is tested.
      // Then it is inside.
      assertTrue(contains(workday, NOON));
    });

    it("excludes an instant outside", () => {
      // Given a minute before opening.
      // When containment is tested.
      // Then it is outside.
      assertFalse(contains(workday, when("2026-03-16T08:59")));
    });

    it("contains everything when unbounded both ways", () => {
      // Given all of time.
      // When any instant is tested.
      // Then it is inside.
      assertTrue(contains(span(undefined, undefined), NOON));
    });
  });

  describe("duration", () => {
    it("measures an ordinary interval", () => {
      // Given a working day on a day with no clock change.
      // When it is measured.
      // Then it is eight hours.
      assertIdentical(
        duration(span("2026-03-16T09:00", "2026-03-16T17:00"))?.toString(),
        "PT8H",
      );
    });

    it("measures exact elapsed time across a spring-forward transition", () => {
      // Given midnight to six on the morning London loses an hour, where 01:00
      // becomes 02:00.
      // When it is measured.
      // Then six hours of clock is five hours of time. This is elapsed time,
      // and the clock face moved underneath it.
      assertIdentical(
        duration(span("2026-03-29T00:00", "2026-03-29T06:00"))?.toString(),
        "PT5H",
      );
    });

    it("has no length when unbounded", () => {
      // Given an interval open at each end in turn.
      // When each is measured.
      // Then neither has a length to give.
      assertUndefined(duration(span(undefined, "2026-03-16T17:00")));
      assertUndefined(duration(span("2026-03-16T09:00", undefined)));
    });
  });
});
