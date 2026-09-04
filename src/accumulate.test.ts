import { inWindow } from "#test/intervals.js";
import {
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { accumulate, type ElapsedUnit } from "./accumulate.js";
import { dates, timeOfDay, weekdays } from "./build.js";
import { layer, merged } from "./cascade.js";

describe("accumulating values over time", () => {
  const week = inWindow("2026-03-09T00:00", "2026-03-16T00:00");
  const workingHours = weekdays().and(timeOfDay("09:00", "17:00"));

  it("adds each value multiplied by how long it applies", () => {
    // Given three people throughout the working week and two extra people for
    // Wednesday's eight-hour shift.
    const wednesday = dates("2026-03-11").and(timeOfDay("09:00", "17:00"));
    const staffing = merged("sum", layer(workingHours, 3), layer(wednesday, 2));

    // When the staffing is totalled in hours.
    const total = accumulate(staffing, week, "hour");

    // Then forty hours at three people and eight at two extra people produce
    // 136 staff-hours.
    assertIdentical(total, 136);
  });

  it("uses the requested elapsed-time unit", () => {
    // Given two units applying for ninety minutes.
    const ninetyMinutes = inWindow("2026-03-09T09:00", "2026-03-09T10:30");
    const rate = merged("sum", layer(workingHours, 2));

    // When the same interval is totalled in hours and minutes.
    const hours = accumulate(rate, ninetyMinutes, "hour");
    const minutes = accumulate(rate, ninetyMinutes, "minute");

    // Then the results express the same accumulation in each unit.
    assertIdentical(hours, 3);
    assertIdentical(minutes, 180);
  });

  it("counts unassigned time as zero", () => {
    // Given a value that applies during working hours only.
    const staffing = merged("sum", layer(workingHours, 3));
    const weekend = inWindow("2026-03-14T00:00", "2026-03-16T00:00");

    // When an uncovered weekend is totalled.
    const total = accumulate(staffing, weekend, "hour");

    // Then no assigned time contributes to the total.
    assertIdentical(total, 0);
  });

  it("measures elapsed time across a clock change", () => {
    // Given a value of one throughout the day London moves its clocks forward.
    const day = inWindow("2026-03-29T00:00", "2026-03-30T00:00");
    const constant = merged("sum", layer({ type: "always" }, 1));

    // When the day is accumulated in hours.
    const total = accumulate(constant, day, "hour");

    // Then the shortened day contributes its twenty-three elapsed hours.
    assertIdentical(total, 23);
  });

  it("requires a finite window", () => {
    // Given a recurring value and a window with no end.
    const staffing = merged("sum", layer(workingHours, 3));
    const openEnded = inWindow("2026-03-09T00:00");

    // When the open-ended value is accumulated.
    const error = assertThrowsError(() =>
      accumulate(staffing, openEnded, "hour"),
    );

    // Then the query refuses a total that could never finish.
    assertInstanceOf(error, RangeError);
  });

  it("refuses calendar units at the runtime boundary", () => {
    // Given a JavaScript caller supplying a calendar unit that TypeScript would
    // reject.
    const staffing = merged("sum", layer(workingHours, 3));
    const calendarUnit = "day" as ElapsedUnit;

    // When the value is accumulated using that unit.
    const error = assertThrowsError(() =>
      accumulate(staffing, week, calendarUnit),
    );

    // Then the error lists the exact elapsed-time units that work.
    assertInstanceOf(error, RangeError);
    assertStringIncludes(error.message, "Expected one of hour, minute, second");
  });
});
