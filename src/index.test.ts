import { span, when } from "#test/intervals.js";
import {
  assertArrayLength,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  clip,
  complement,
  contains,
  duration,
  intersect,
  intervals,
  type Rule,
  union,
} from "./index.js";

/**
 * A smoke test of the public surface. Everything a consumer needs is reachable
 * from the entry point, and composes once it gets there.
 */
describe("the public entry point", () => {
  it("composes the algebra into an answer", () => {
    // Given two days of office hours with lunch closed in the middle of each,
    // and a visitor in the building from Monday lunchtime to Tuesday morning.
    const officeHours = [
      span("2026-03-16T09:00", "2026-03-16T17:00"),
      span("2026-03-17T09:00", "2026-03-17T17:00"),
    ];
    const closedForLunch = [
      span("2026-03-16T12:30", "2026-03-16T13:30"),
      span("2026-03-17T12:30", "2026-03-17T13:30"),
    ];
    const visiting = span("2026-03-16T13:00", "2026-03-17T10:00");

    // When the three are composed with the operations the entry point exports.
    const open = intersect(officeHours, complement(closedForLunch));
    const reachable = [...clip(open, visiting)];

    // Then the visitor has Monday afternoon and Tuesday's first hour.
    assertIdentical(
      reachable.map((interval) => duration(interval)?.toString()).join(" "),
      "PT3H30M PT1H",
    );
  });

  it("reads a rule through the entry point", () => {
    // Given Monday office hours, written as the document a consumer would
    // store, with no builder involved.
    const officeHours: Rule = {
      type: "all",
      rules: [
        { type: "daysOfWeek", days: ["monday"] },
        { type: "timeOfDay", from: "09:00", to: "17:00" },
      ],
    };

    // When the week is read.
    const week = [
      ...intervals(officeHours, {
        from: when("2026-03-09T00:00"),
        to: when("2026-03-16T00:00"),
      }),
    ];

    // Then it holds the one Monday, eight hours long.
    assertArrayLength(week, 1);
    assertIdentical(duration(week[0])?.toString(), "PT8H");
  });

  it("exposes union and containment", () => {
    // Given a morning and an afternoon that meet at noon.
    const morning = [span("2026-03-16T09:00", "2026-03-16T12:00")];
    const afternoon = [span("2026-03-16T12:00", "2026-03-16T17:00")];

    // When they are unioned.
    const merged = [...union(morning, afternoon)];

    // Then they come back as one stretch holding the whole day.
    assertArrayLength(merged, 1);
    assertTrue(contains(merged[0], when("2026-03-16T15:00")));
  });
});
