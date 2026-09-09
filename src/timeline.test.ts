import { storedJSON } from "#test/stored-json.js";
import { inWindow, when } from "#test/intervals.js";
import {
  assertArrayEmpty,
  assertArrayLength,
  assertIdentical,
  assertInstanceOf,
  assertNonNullable,
  assertStringIncludes,
  assertStringNotIncludes,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { assigned } from "./assigned.js";
import { timeOfDayRange, weekdays } from "./build.js";
import { assertJsonValue } from "./json.js";
import { rota } from "./rota.js";
import { schedule } from "./schedule.js";
import { timeline, renderTimeline, type Timeline } from "./timeline.js";

describe("rendering covered time as a timeline", () => {
  it("returns JSON-compatible local days with exact covered hours", () => {
    // Given weekday office hours and a window containing Monday and Tuesday.
    const office = weekdays().and(timeOfDayRange("09:00", "17:00"));
    const twoDays = inWindow("2026-03-09T00:00", "2026-03-11T00:00");

    // When the covered time is rendered using the default JSON format.
    const data = timeline(office, twoDays);

    // Then callers receive plain data with one entry per local day.
    assertJsonValue(data);
    assertIdentical(data.type, "timeline");
    assertIdentical(data.zone, "Europe/London");
    assertIdentical(data.from, "2026-03-09T00:00:00+00:00[Europe/London]");
    assertIdentical(data.to, "2026-03-11T00:00:00+00:00[Europe/London]");
    assertArrayLength(data.days, 2);
    const monday = data.days[0];
    assertNonNullable(monday);
    const opening = monday.covered[0];
    assertNonNullable(opening);
    assertIdentical(monday.date, "2026-03-09");
    assertIdentical(opening.start, "2026-03-09T09:00:00+00:00[Europe/London]");
    assertIdentical(opening.end, "2026-03-09T17:00:00+00:00[Europe/London]");
  });

  it("draws text from the JSON timeline", () => {
    // Given weekday office hours and a window containing Monday and Tuesday.
    const office = weekdays().and(timeOfDayRange("09:00", "17:00"));
    const twoDays = inWindow("2026-03-09T00:00", "2026-03-11T00:00");

    // When the covered time is rendered as text.
    const rendered = renderTimeline(timeline(office, twoDays));

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
    const shortOpening = timeOfDayRange("09:10", "09:20");
    const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

    // When the day is rendered as text.
    const rendered = renderTimeline(timeline(shortOpening, monday));

    // Then the cell says it is partial and the label gives exact times.
    assertStringIncludes(
      rendered,
      "|..................+.............................| 09:10-09:20",
    );
  });

  it("keeps seconds in exact interval labels", () => {
    // Given coverage whose boundaries fall between whole minutes.
    const precise = timeOfDayRange("09:10:15", "09:20:45");
    const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

    // When the day is rendered.
    const rendered = renderTimeline(timeline(precise, monday));

    // Then the right-hand label preserves both boundaries.
    assertStringIncludes(rendered, "09:10:15-09:20:45");
  });

  it("includes uncovered days", () => {
    // Given weekday office hours viewed on a Saturday.
    const office = weekdays().and(timeOfDayRange("09:00", "17:00"));
    const saturday = inWindow("2026-03-14T00:00", "2026-03-15T00:00");

    // When the day is rendered.
    const rendered = renderTimeline(timeline(office, saturday));

    // Then the empty row stays visible and is labelled clearly.
    assertStringIncludes(
      rendered,
      "Sat 2026-03-14 |................................................| none",
    );
  });

  it("splits overnight coverage at the local day boundary", () => {
    // Given a night shift and a window spanning its first occurrence.
    const nights = timeOfDayRange("22:00", "06:00");
    const overnight = inWindow("2026-03-09T21:00", "2026-03-10T07:00");

    // When the coverage is rendered.
    const rendered = renderTimeline(timeline(nights, overnight));

    // Then each day row names its part of the same opening.
    assertStringIncludes(rendered, "22:00-24:00");
    assertStringIncludes(rendered, "00:00-06:00");
  });

  it("renders one selected rota assignment", () => {
    // Given a rota shared between Alice and Bob on Monday.
    const onCall = rota()
      .assign(timeOfDayRange("09:00", "13:00"), "alice")
      .assign(timeOfDayRange("13:00", "17:00"), "bob");
    const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

    // When Alice's assigned time is rendered.
    const rendered = renderTimeline(
      timeline(assigned(onCall, "alice"), monday),
    );

    // Then only Alice's four hours appear.
    assertStringIncludes(rendered, "|..................########");
    assertStringIncludes(rendered, "09:00-13:00");
    assertStringNotIncludes(rendered, "13:00-17:00");
  });

  it("returns an empty JSON timeline for a window containing no time", () => {
    // Given a window whose start and end are the same instant.
    const instant = when("2026-03-09T09:00");

    // When it is rendered in both available formats.
    const data = timeline(weekdays(), { from: instant, to: instant });
    const text = renderTimeline(
      timeline(weekdays(), { from: instant, to: instant }),
    );

    // Then the data has no days and the text says why it has no rows.
    assertArrayEmpty(data.days);
    assertIdentical(text, "No time in the requested window.");
  });

  it("requires a finite window", () => {
    // Given a recurring rule and a window with no end.
    const openEnded = inWindow("2026-03-09T00:00");

    // When it is rendered.
    const error = assertThrowsError(() =>
      // @ts-expect-error A window without to is also refused at runtime.
      timeline(weekdays(), openEnded),
    );

    // Then the renderer refuses output that could never finish.
    assertInstanceOf(error, RangeError);
    assertStringIncludes(error.message, "finite window");
  });

  it("renders stored timeline data", () => {
    // Given timeline data that has passed through JSON storage.
    const original = timeline(
      weekdays(),
      inWindow("2026-03-09T00:00", "2026-03-10T00:00"),
    );
    const restored = storedJSON(original) as Timeline;

    // When the stored data is rendered without its original rule.
    const text = renderTimeline(restored);

    // Then the day and its full coverage remain visible.
    assertStringIncludes(text, "Mon 2026-03-09");
    assertStringIncludes(text, "00:00-24:00");
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
    const data = office.timeline(from, to);

    // Then it uses the Monday and local hours from the declared zone.
    assertIdentical(data.zone, "Europe/London");
    const monday = data.days[0];
    assertNonNullable(monday);
    const opening = monday.covered[0];
    assertNonNullable(opening);
    assertIdentical(monday.date, "2026-06-01");
    assertIdentical(opening.start, "2026-06-01T09:00:00+01:00[Europe/London]");
  });
});
