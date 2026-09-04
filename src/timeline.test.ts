import { inWindow, when } from "#test/intervals.js";
import {
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertStringNotIncludes,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { assigned } from "./assigned.js";
import { timeOfDay, weekdays } from "./build.js";
import { rota } from "./rota.js";
import { schedule } from "./schedule.js";
import {
  renderTimeline,
  type TimelineFormat,
  type TimelineOptions,
} from "./timeline.js";

describe("rendering covered time as a timeline", () => {
  it("draws local days with exact covered hours", () => {
    // Given weekday office hours and a window containing Monday and Tuesday.
    const office = weekdays().and(timeOfDay("09:00", "17:00"));
    const twoDays = inWindow("2026-03-09T00:00", "2026-03-11T00:00");

    // When the covered time is rendered using the default text format.
    const rendered = renderTimeline(office, twoDays);

    // Then each day has an at-a-glance chart and its exact opening interval.
    assertIdentical(
      rendered,
      "Time zone: Europe/London\n" +
        "                00:00       06:00       12:00       18:00       24:00\n" +
        "Mon 2026-03-09 |..................################..............| 09:00-17:00\n" +
        "Tue 2026-03-10 |..................################..............| 09:00-17:00\n" +
        "# covered  + partly covered  . uncovered",
    );
  });

  it("marks partial half-hour cells without hiding the exact interval", () => {
    // Given ten covered minutes inside one half-hour chart cell.
    const shortOpening = timeOfDay("09:10", "09:20");
    const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

    // When the day is rendered as text.
    const rendered = renderTimeline(shortOpening, monday);

    // Then the cell says it is partial and the label gives exact times.
    assertStringIncludes(
      rendered,
      "|..................+.............................| 09:10-09:20",
    );
  });

  it("keeps seconds in exact interval labels", () => {
    // Given coverage whose boundaries fall between whole minutes.
    const precise = timeOfDay("09:10:15", "09:20:45");
    const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

    // When the day is rendered.
    const rendered = renderTimeline(precise, monday);

    // Then the right-hand label preserves both boundaries.
    assertStringIncludes(rendered, "09:10:15-09:20:45");
  });

  it("includes uncovered days", () => {
    // Given weekday office hours viewed on a Saturday.
    const office = weekdays().and(timeOfDay("09:00", "17:00"));
    const saturday = inWindow("2026-03-14T00:00", "2026-03-15T00:00");

    // When the day is rendered.
    const rendered = renderTimeline(office, saturday);

    // Then the empty row stays visible and is labelled clearly.
    assertStringIncludes(
      rendered,
      "Sat 2026-03-14 |................................................| none",
    );
  });

  it("splits overnight coverage at the local day boundary", () => {
    // Given a night shift and a window spanning its first occurrence.
    const nights = timeOfDay("22:00", "06:00");
    const overnight = inWindow("2026-03-09T21:00", "2026-03-10T07:00");

    // When the coverage is rendered.
    const rendered = renderTimeline(nights, overnight);

    // Then each day row names its part of the same opening.
    assertStringIncludes(rendered, "22:00-24:00");
    assertStringIncludes(rendered, "00:00-06:00");
  });

  it("renders one selected rota assignment", () => {
    // Given a rota shared between Alice and Bob on Monday.
    const onCall = rota()
      .assign(timeOfDay("09:00", "13:00"), "alice")
      .assign(timeOfDay("13:00", "17:00"), "bob");
    const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

    // When Alice's assigned time is rendered.
    const rendered = renderTimeline(assigned(onCall, "alice"), monday);

    // Then only Alice's four hours appear.
    assertStringIncludes(rendered, "|..................########");
    assertStringIncludes(rendered, "09:00-13:00");
    assertStringNotIncludes(rendered, "13:00-17:00");
  });

  it("produces a standalone accessible SVG", () => {
    // Given one day of office hours.
    const office = weekdays().and(timeOfDay("09:00", "17:00"));
    const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

    // When the timeline is rendered as SVG.
    const rendered = renderTimeline(office, monday, { format: "svg" });

    // Then the image describes itself and draws the exact opening span.
    assertStringIncludes(rendered, '<svg xmlns="http://www.w3.org/2000/svg"');
    assertStringIncludes(rendered, 'aria-label="Coverage timeline"');
    assertStringIncludes(rendered, "<title>Coverage timeline</title>");
    assertStringIncludes(rendered, "Mon 2026-03-09");
    assertStringIncludes(
      rendered,
      '<rect x="410" y="54" width="240" height="20" rx="2" class="covered"/>',
    );
    assertStringIncludes(rendered, "09:00-17:00");
  });

  it("says when the requested window contains no time", () => {
    // Given a window whose start and end are the same instant.
    const instant = when("2026-03-09T09:00");

    // When it is rendered.
    const rendered = renderTimeline(weekdays(), { from: instant, to: instant });

    // Then the result states why it has no rows.
    assertIdentical(rendered, "No time in the requested window.");
  });

  it("requires a finite window", () => {
    // Given a recurring rule and a window with no end.
    const openEnded = inWindow("2026-03-09T00:00");

    // When it is rendered.
    const error = assertThrowsError(() =>
      renderTimeline(weekdays(), openEnded),
    );

    // Then the renderer refuses output that could never finish.
    assertInstanceOf(error, RangeError);
    assertStringIncludes(error.message, "needs a window with an end");
  });

  it("refuses unknown formats at the runtime boundary", () => {
    // Given an unsupported format from an untyped JavaScript caller.
    const format = "png" as TimelineFormat;
    const options: TimelineOptions = { format };

    // When the timeline is rendered using that format.
    const error = assertThrowsError(() =>
      renderTimeline(
        weekdays(),
        inWindow("2026-03-09T00:00", "2026-03-10T00:00"),
        options,
      ),
    );

    // Then the supported text and SVG formats are named.
    assertInstanceOf(error, RangeError);
    assertStringIncludes(error.message, "text or svg");
  });

  it("uses a schedule's declared zone for its day rows", () => {
    // Given London office hours and their Monday viewed through UTC instants.
    const office = schedule({ zone: "Europe/London" }).open(
      weekdays(),
      "09:00-17:00",
    );
    const from = when("2026-05-31T23:00", "UTC");
    const to = when("2026-06-01T23:00", "UTC");

    // When the schedule renders its timeline.
    const rendered = office.renderTimeline(from, to);

    // Then it displays the Monday and the local hours used to define it.
    assertStringIncludes(rendered, "Mon 2026-06-01");
    assertStringIncludes(rendered, "Time zone: Europe/London");
    assertStringIncludes(rendered, "09:00-17:00");
    assertStringNotIncludes(rendered, "Sun 2026-05-31");
  });
});
