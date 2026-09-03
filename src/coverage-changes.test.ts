import { inWindow, render } from "#test/intervals.js";
import { assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import { always, daysOfWeek, timeOfDay, weekdays } from "./build.js";
import { coverageChanges } from "./coverage-changes.js";

describe("coverage changes", () => {
  it("returns the time added and removed", () => {
    // Given office hours moved one hour later.
    const before = weekdays().and(timeOfDay("09:00", "17:00"));
    const after = weekdays().and(timeOfDay("10:00", "18:00"));
    const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

    // When their coverage is compared over Monday.
    const changed = coverageChanges(before, after, monday);

    // Then the final hour was added and the first hour was removed.
    assertIdentical(
      render(changed.added),
      "[2026-03-09T17:00:00,2026-03-09T18:00:00)",
    );
    assertIdentical(
      render(changed.removed),
      "[2026-03-09T09:00:00,2026-03-09T10:00:00)",
    );
  });

  it("compares evaluated coverage instead of document structure", () => {
    // Given two definitions that cover the same day by different routes.
    const everyDay = daysOfWeek(
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    );
    const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

    // When the weekday definition is compared with all time.
    const changed = coverageChanges(everyDay, always(), monday);

    // Then neither spelling adds or removes covered time in the window.
    assertIdentical(render(changed.added), "");
    assertIdentical(render(changed.removed), "");
  });
});
