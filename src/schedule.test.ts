import { inWindow, render, when } from "#test/intervals.js";
import {
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { all, dates, timeOfDay, weekdays } from "./build.js";
import { cascade, layer, replace } from "./cascade.js";
import { resolve } from "./resolve.js";
import { schedule } from "./schedule.js";

const OPENING_HOURS = schedule()
  .open(weekdays(), "09:00-17:00")
  .hoursOn("2026-03-11", "09:00-15:00");

const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

describe("a schedule", () => {
  it("is the cascade it would have been written as by hand", () => {
    // The whole claim of this layer: it is vocabulary, not a second world.
    // Anything that reads a cascade reads a schedule, and the stored document
    // is the same either way.
    const usualHours = all(weekdays(), timeOfDay("09:00", "17:00"));
    const early = replace(dates("2026-03-11"), timeOfDay("09:00", "15:00"));
    const byHand = cascade(layer(usualHours, true), early);

    assertIdentical(JSON.stringify(OPENING_HOURS), JSON.stringify(byHand));
  });

  it("can be resolved by the core, being one", () => {
    const open = [...resolve(OPENING_HOURS, WEEK)].filter(
      (period) => period.value,
    );

    assertIdentical(
      render(open),
      "[2026-03-09T09:00:00,2026-03-09T17:00:00) " +
        "[2026-03-10T09:00:00,2026-03-10T17:00:00) " +
        "[2026-03-11T09:00:00,2026-03-11T15:00:00) " +
        "[2026-03-12T09:00:00,2026-03-12T17:00:00) " +
        "[2026-03-13T09:00:00,2026-03-13T17:00:00)",
    );
  });

  it("opens for whole days when given no hours", () => {
    const everyWeekday = schedule().open(weekdays());

    assertTrue(everyWeekday.isOpen(when("2026-03-09T03:00")));
  });
});

describe("reading it in the order it is said", () => {
  const openingHours = schedule()
    .open(weekdays(), "09:00-17:00")
    .closed("2026-03-10")
    .hoursOn("2026-03-11", "09:00-15:00");

  it("is open during the usual hours", () => {
    assertTrue(openingHours.isOpen(when("2026-03-09T10:00")));
  });

  it("is shut on the day said to be closed", () => {
    assertFalse(openingHours.isOpen(when("2026-03-10T10:00")));
  });

  it("keeps the replaced hours on the day they were replaced", () => {
    assertTrue(openingHours.isOpen(when("2026-03-11T14:00")));
  });

  it("does not let the usual hours show through a replaced day", () => {
    // Half past three on the day it closes at three. Being closed here is the
    // difference between "these hours instead" and "shut between three and
    // five as well as the usual hours".
    assertFalse(openingHours.isOpen(when("2026-03-11T15:30")));
  });
});

describe("asking a schedule questions", () => {
  it("says how long it is open between two moments", () => {
    const open = OPENING_HOURS.openBetween(WEEK.from, when("2026-03-16T00:00"));

    assertIdentical(open.toString(), "PT38H");
  });

  it("finds the next opening", () => {
    const next = OPENING_HOURS.opensNext(when("2026-03-13T18:00"));

    assertIdentical(
      next?.start?.toPlainDateTime().toString(),
      "2026-03-16T09:00:00",
    );
  });

  it("gives back the stretch it is already in", () => {
    const next = OPENING_HOURS.opensNext(when("2026-03-09T10:00"));

    assertIdentical(
      next?.start?.toPlainDateTime().toString(),
      "2026-03-09T10:00:00",
    );
  });

  it("gives the whole opening even when the horizon stops inside it", () => {
    // Two hours of looking finds the nine o'clock opening. The horizon bounded
    // the search; it is not a closing time, and reporting it as one would be a
    // wrong answer rather than a partial one.
    const twoHours = Temporal.Duration.from({ hours: 2 });
    const next = OPENING_HOURS.opensNext(when("2026-03-09T08:00"), twoHours);

    assertIdentical(
      next?.end?.toPlainDateTime().toString(),
      "2026-03-09T17:00:00",
    );
  });

  it("finds nothing when the horizon is too short", () => {
    const soon = Temporal.Duration.from({ hours: 2 });
    const next = OPENING_HOURS.opensNext(when("2026-03-13T18:00"), soon);

    assertUndefined(next);
  });

  it("is shut when nothing has been said about it", () => {
    assertFalse(schedule().isOpen(when("2026-03-09T10:00")));
  });

  it("steps over a closed day rather than counting it as the next opening", () => {
    // The Tuesday is claimed and shut, so it is in the stream carrying false.
    // Both questions have to see that and keep looking.
    const openingHours = schedule()
      .open(weekdays(), "09:00-17:00")
      .closed("2026-03-10");

    const next = openingHours.opensNext(when("2026-03-09T18:00"));
    const week = openingHours.openBetween(WEEK.from, when("2026-03-16T00:00"));

    assertIdentical(
      next?.start?.toPlainDateTime().toString(),
      "2026-03-11T09:00:00",
    );
    assertIdentical(week.toString(), "PT32H");
  });
});

describe("the plain forms it accepts", () => {
  it("refuses a range that is not one", () => {
    const error = assertThrowsError(() =>
      schedule().open(weekdays(), "9 til 5"),
    );

    assertInstanceOf(error, RangeError);
    assertStringIncludes(
      error.message,
      'Expected something like "09:00-17:00"',
    );
  });

  it("refuses a time that is not one", () => {
    const error = assertThrowsError(() =>
      schedule().open(weekdays(), "09:00-half five"),
    );

    assertStringIncludes(error.message, '"half five" is not a time of day');
  });

  it("refuses a date that is not one", () => {
    const error = assertThrowsError(() => schedule().closed("Christmas"));

    assertStringIncludes(error.message, '"Christmas" is not a date');
  });

  it("takes a rule wherever it takes a string", () => {
    const nightShift = timeOfDay("22:00", "06:00");
    const nights = schedule().open(weekdays(), nightShift);

    assertTrue(nights.isOpen(when("2026-03-10T02:00")));
  });
});
