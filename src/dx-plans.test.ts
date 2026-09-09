import { when } from "#test/intervals.js";
import {
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertNonNullable,
  assertThrowsError,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";
import {
  allowsPlan,
  atMostOccupiedTime,
  firstBreach,
  MissingOccurrencesError,
  parseRRule,
  timeOfDayRange,
  toRRule,
  weekdays,
  isActiveAt,
} from "./index.js";

describe("checking whole occurrences", () => {
  it("counts a candidate's full duration against a calendar cap", () => {
    // Given a one-hour allowance and a two-hour proposed booking.
    const cap = atMostOccupiedTime({ hours: 1 }, { per: "day" });
    const at = when("2026-03-09T09:00");
    const plan = [{ at, lasting: Temporal.Duration.from({ hours: 2 }) }];

    // When the whole plan is checked against an explicitly empty history.
    const breach = firstBreach(cap, plan, { occurrences: [] });

    // Then the booking is refused and its original index is retained.
    assertFalse(allowsPlan(cap, plan, { occurrences: [] }));
    assertNonNullable(breach);
    assertIdentical(breach.index, 0);
    assertTrue(breach.at.equals(at));
    assertIdentical(breach.explanation.status, "unmatched");
  });

  it("allows occupancy exactly equal to the cap", () => {
    // Given a one-hour booking and a one-hour daily allowance.
    const cap = atMostOccupiedTime("PT1H", { per: "day" });
    const plan = [
      {
        at: when("2026-03-09T09:00"),
        lasting: Temporal.Duration.from({ hours: 1 }),
      },
    ];

    // When the whole booking is checked.
    const allowed = allowsPlan(cap, plan, { occurrences: [] });

    // Then an exact fit is allowed.
    assertTrue(allowed);
  });

  it("detects a rolling cap crossed during the proposed occurrence", () => {
    // Given a two-hour booking and a one-hour rolling allowance.
    const cap = atMostOccupiedTime("PT1H", { within: { hours: 24 } });
    const at = when("2026-03-09T09:00");

    // When the first violation within the booking is requested.
    const breach = firstBreach(
      cap,
      [{ at, lasting: Temporal.Duration.from({ hours: 2 }) }],
      { occurrences: [] },
    );

    // Then the first violating instant is after the first full hour.
    assertNonNullable(breach);
    assertTrue(breach.at.equals(at.add({ hours: 1, nanoseconds: 1 })));
  });

  it("treats overlapping occupancy as one occupied period", () => {
    // Given an hour already occupied and an overlapping half-hour proposal.
    const at = when("2026-03-09T09:00");
    const cap = atMostOccupiedTime("PT1H", { per: "day" });
    const existing = [{ at, lasting: Temporal.Duration.from({ hours: 1 }) }];
    const proposed = [
      {
        at: at.add({ minutes: 15 }),
        lasting: Temporal.Duration.from({ minutes: 30 }),
      },
    ];

    // When the combined occupancy is checked.
    const allowed = allowsPlan(cap, proposed, { occurrences: existing });

    // Then overlapping records do not consume the same time twice.
    assertTrue(allowed);
  });

  it("gives the same answer for a booking and its adjacent parts", () => {
    // Given two representations of the same two-hour occupancy.
    const at = when("2026-03-09T09:00");
    const whole = [{ at, lasting: Temporal.Duration.from({ hours: 2 }) }];
    const split = [0, 1].map((hours) => ({
      at: at.add({ hours }),
      lasting: Temporal.Duration.from({ hours: 1 }),
    }));
    const cap = atMostOccupiedTime("PT90M", { per: "day" });

    // When each representation is checked independently.
    const wholeAllowed = allowsPlan(cap, whole, { occurrences: [] });
    const splitAllowed = allowsPlan(cap, split, { occurrences: [] });

    // Then both exceed the same allowance.
    assertFalse(wholeAllowed);
    assertIdentical(splitAllowed, wholeAllowed);
    assertInstanceOf(
      assertThrowsError(() => allowsPlan(cap, whole)),
      MissingOccurrencesError,
    );
  });
});

describe("recurrence fidelity", () => {
  it("imports the complete exported record including its duration", () => {
    // Given weekday office hours exported as a recurrence and duration.
    const office = weekdays().and(timeOfDayRange("09:00", "17:00"));
    const written = toRRule(office, { start: "2026-03-09" });
    assertTrue(written.ok);

    // When the complete record is imported.
    const restored = parseRRule(written);

    // Then the full working day is retained.
    assertTrue(isActiveAt(restored, when("2026-03-09T12:00")));
    assertFalse(isActiveAt(restored, when("2026-03-09T17:00")));
  });

  it("rejects timestamp bounds whose precision cannot be preserved", () => {
    // Given a recurrence ending before its start time on the final date.
    const text = "FREQ=DAILY;UNTIL=20260309T100000";

    // When the timestamp bound is parsed.
    const error = assertThrowsError(() =>
      parseRRule(text, { start: "2026-03-08T17:00" }),
    );

    // Then parsing refuses the unsupported bound instead of extending coverage.
    assertInstanceOf(error, TypeError);
  });
});
