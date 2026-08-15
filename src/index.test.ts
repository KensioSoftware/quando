import { span } from "#test/intervals.js";
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
 * A smoke test of the public surface: everything a consumer needs for the
 * interval core is reachable from the entry point, and composes.
 */
describe("the public entry point", () => {
  it("composes the algebra into an answer", () => {
    const officeHours = [
      span("2026-03-16T09:00", "2026-03-16T17:00"),
      span("2026-03-17T09:00", "2026-03-17T17:00"),
    ];
    const closedForLunch = [
      span("2026-03-16T12:30", "2026-03-16T13:30"),
      span("2026-03-17T12:30", "2026-03-17T13:30"),
    ];
    const visiting = span("2026-03-16T13:00", "2026-03-17T10:00");

    const open = intersect(officeHours, complement(closedForLunch));
    const reachable = [...clip(open, visiting)];

    assertIdentical(
      reachable.map((interval) => duration(interval)?.toString()).join(" "),
      "PT3H30M PT1H",
    );
  });

  it("reads a rule through the entry point", () => {
    const officeHours: Rule = {
      type: "all",
      rules: [
        { type: "daysOfWeek", days: ["monday"] },
        { type: "timeOfDay", from: "09:00", to: "17:00" },
      ],
    };
    const week = [
      ...intervals(officeHours, {
        from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
        to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
      }),
    ];

    assertArrayLength(week, 1);
    assertIdentical(duration(week[0])?.toString(), "PT8H");
  });

  it("exposes union and containment", () => {
    const merged = [
      ...union(
        [span("2026-03-16T09:00", "2026-03-16T12:00")],
        [span("2026-03-16T12:00", "2026-03-16T17:00")],
      ),
    ];

    assertArrayLength(merged, 1);
    assertTrue(
      contains(
        merged[0],
        Temporal.ZonedDateTime.from("2026-03-16T15:00[Europe/London]"),
      ),
    );
  });
});
