import { inWindow, render } from "#test/intervals.js";
import {
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { intervals } from "./interpret.js";
import type { Rule } from "./rule.js";
import { take } from "./stream.js";

/** Monday 2026-03-09 to Monday 2026-03-16, a whole week. */
const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

const read = (rule: Rule, context = WEEK): string =>
  render(intervals(rule, context));

describe("always and never", () => {
  it("covers the whole window", () => {
    assertIdentical(
      read({ type: "always" }),
      "[2026-03-09T00:00:00,2026-03-16T00:00:00)",
    );
  });

  it("covers nothing", () => {
    assertIdentical(read({ type: "never" }), "");
  });

  it("runs to the unbounded future when the window has no end", () => {
    assertIdentical(
      read({ type: "always" }, inWindow("2026-03-09T00:00")),
      "[2026-03-09T00:00:00,*)",
    );
  });
});

describe("days of the week", () => {
  it("selects single days", () => {
    assertIdentical(
      read({ type: "daysOfWeek", days: ["wednesday"] }),
      "[2026-03-11T00:00:00,2026-03-12T00:00:00)",
    );
  });

  it("merges a run of consecutive days into one interval", () => {
    // The contract is coalesced output, so Saturday and Sunday are one weekend
    // rather than two intervals that touch at midnight.
    assertIdentical(
      read({ type: "daysOfWeek", days: ["saturday", "sunday"] }),
      "[2026-03-14T00:00:00,2026-03-16T00:00:00)",
    );
  });

  it("keeps non-consecutive days apart", () => {
    assertIdentical(
      read({ type: "daysOfWeek", days: ["monday", "wednesday"] }),
      "[2026-03-09T00:00:00,2026-03-10T00:00:00) " +
        "[2026-03-11T00:00:00,2026-03-12T00:00:00)",
    );
  });

  it("terminates when every day matches, because the window ends", () => {
    // The run never closes on its own; only the window's end flushes it.
    assertIdentical(
      read({
        type: "daysOfWeek",
        days: [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ],
      }),
      "[2026-03-09T00:00:00,2026-03-16T00:00:00)",
    );
  });

  it("covers nothing when no days are selected, without walking the calendar", () => {
    // An unbounded context and a predicate that never matches would otherwise
    // send the walk forward to Temporal's year limit and fail there.
    const endless = intervals(
      { type: "daysOfWeek", days: [] },
      inWindow("2026-03-09T00:00"),
    );
    assertIdentical(render(take(endless, 1)), "");
  });

  it("is endless without a window, and still cheap to sample", () => {
    const endless = intervals(
      { type: "daysOfWeek", days: ["wednesday"] },
      inWindow("2026-03-09T00:00"),
    );
    assertIdentical(
      render(take(endless, 2)),
      "[2026-03-11T00:00:00,2026-03-12T00:00:00) " +
        "[2026-03-18T00:00:00,2026-03-19T00:00:00)",
    );
  });
});

describe("times of day", () => {
  it("repeats a window each day", () => {
    const twoDays = inWindow("2026-03-09T00:00", "2026-03-11T00:00");
    assertIdentical(
      read({ type: "timeOfDay", from: "09:00", to: "17:00" }, twoDays),
      "[2026-03-09T09:00:00,2026-03-09T17:00:00) " +
        "[2026-03-10T09:00:00,2026-03-10T17:00:00)",
    );
  });

  it("wraps past midnight for a night shift", () => {
    const twoDays = inWindow("2026-03-09T00:00", "2026-03-11T00:00");
    assertIdentical(
      read({ type: "timeOfDay", from: "22:00", to: "06:00" }, twoDays),
      "[2026-03-09T00:00:00,2026-03-09T06:00:00) " +
        "[2026-03-09T22:00:00,2026-03-10T06:00:00) " +
        "[2026-03-10T22:00:00,2026-03-11T00:00:00)",
    );
  });

  it("refuses a window whose start and end coincide", () => {
    const error = assertThrowsError(() =>
      read({ type: "timeOfDay", from: "09:00", to: "09:00" }),
    );
    assertInstanceOf(error, RangeError);
  });

  it("keeps wall-clock hours across a spring-forward transition", () => {
    // Clocks go forward at 01:00 on the 29th. The window is still 09:00-17:00.
    const dstWeekend = inWindow("2026-03-28T00:00", "2026-03-30T00:00");
    assertIdentical(
      read({ type: "timeOfDay", from: "09:00", to: "17:00" }, dstWeekend),
      "[2026-03-28T09:00:00,2026-03-28T17:00:00) " +
        "[2026-03-29T09:00:00,2026-03-29T17:00:00)",
    );
  });
});

describe("dates", () => {
  it("selects the days named", () => {
    assertIdentical(
      read({ type: "dates", dates: ["2026-03-12"] }),
      "[2026-03-12T00:00:00,2026-03-13T00:00:00)",
    );
  });

  it("sorts, de-duplicates and merges consecutive dates", () => {
    assertIdentical(
      read({
        type: "dates",
        dates: ["2026-03-11", "2026-03-10", "2026-03-11"],
      }),
      "[2026-03-10T00:00:00,2026-03-12T00:00:00)",
    );
  });

  it("covers nothing when given no dates", () => {
    assertIdentical(read({ type: "dates", dates: [] }), "");
  });

  it("ends with the dates, without walking the calendar between them", () => {
    const wide = inWindow("2026-01-01T00:00", "2027-01-01T00:00");
    assertIdentical(
      read({ type: "dates", dates: ["2026-12-25", "2026-01-01"] }, wide),
      "[2026-01-01T00:00:00,2026-01-02T00:00:00) " +
        "[2026-12-25T00:00:00,2026-12-26T00:00:00)",
    );
  });
});

describe("combining rules", () => {
  const officeHours: Rule = {
    type: "all",
    rules: [
      {
        type: "daysOfWeek",
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      },
      { type: "timeOfDay", from: "09:00", to: "17:00" },
    ],
  };

  it("intersects", () => {
    const twoDays = inWindow("2026-03-13T00:00", "2026-03-15T00:00");
    // Friday has office hours; Saturday does not.
    assertIdentical(
      read(officeHours, twoDays),
      "[2026-03-13T09:00:00,2026-03-13T17:00:00)",
    );
  });

  it("takes no rules in `all` as no limits", () => {
    assertIdentical(
      read({ type: "all", rules: [] }),
      "[2026-03-09T00:00:00,2026-03-16T00:00:00)",
    );
  });

  it("unions", () => {
    assertIdentical(
      read({
        type: "any",
        rules: [
          { type: "daysOfWeek", days: ["saturday"] },
          { type: "dates", dates: ["2026-03-11"] },
        ],
      }),
      "[2026-03-11T00:00:00,2026-03-12T00:00:00) " +
        "[2026-03-14T00:00:00,2026-03-15T00:00:00)",
    );
  });

  it("takes no rules in `any` as no times", () => {
    assertIdentical(read({ type: "any", rules: [] }), "");
  });

  it("complements within the window rather than beyond it", () => {
    assertIdentical(
      read({
        type: "not",
        rule: { type: "daysOfWeek", days: ["saturday", "sunday"] },
      }),
      "[2026-03-09T00:00:00,2026-03-14T00:00:00)",
    );
  });

  it("excludes a holiday from a working week", () => {
    const excused: Rule = {
      type: "all",
      rules: [
        officeHours,
        { type: "not", rule: { type: "dates", dates: ["2026-03-11"] } },
      ],
    };
    assertIdentical(
      read(excused),
      "[2026-03-09T09:00:00,2026-03-09T17:00:00) " +
        "[2026-03-10T09:00:00,2026-03-10T17:00:00) " +
        "[2026-03-12T09:00:00,2026-03-12T17:00:00) " +
        "[2026-03-13T09:00:00,2026-03-13T17:00:00)",
    );
  });
});

describe("zones", () => {
  it("reads a rule in the context's zone by default", () => {
    const tokyo = inWindow(
      "2026-03-09T00:00",
      "2026-03-10T00:00",
      "Asia/Tokyo",
    );
    assertIdentical(
      read({ type: "timeOfDay", from: "09:00", to: "17:00" }, tokyo),
      "[2026-03-09T09:00:00,2026-03-09T17:00:00)",
    );
  });

  it("lets a rule name its own zone, so one rule set can span offices", () => {
    // London office hours, asked about from Tokyo. London is nine hours behind
    // in March, so 09:00-17:00 there is 18:00-02:00 here — and the answers come
    // back in Tokyo time, because that is the zone the question was asked in.
    const tokyoDays = inWindow(
      "2026-03-09T00:00",
      "2026-03-11T00:00",
      "Asia/Tokyo",
    );
    assertIdentical(
      read(
        {
          type: "timeOfDay",
          from: "09:00",
          to: "17:00",
          zone: "Europe/London",
        },
        tokyoDays,
      ),
      "[2026-03-09T00:00:00,2026-03-09T02:00:00) " +
        "[2026-03-09T18:00:00,2026-03-10T02:00:00) " +
        "[2026-03-10T18:00:00,2026-03-11T00:00:00)",
    );
  });

  it("reads every interval back in one zone, never a mix of two", () => {
    // A sweep may take one interval's start and another's end, and those can
    // have been written in different zones. Both halves must still agree.
    const tokyo = inWindow(
      "2026-03-09T00:00",
      "2026-03-10T00:00",
      "Asia/Tokyo",
    );
    const london: Rule = {
      type: "timeOfDay",
      from: "09:00",
      to: "17:00",
      zone: "Europe/London",
    };

    for (const interval of intervals(london, tokyo)) {
      assertIdentical(interval.start?.timeZoneId, "Asia/Tokyo");
      assertIdentical(interval.end?.timeZoneId, "Asia/Tokyo");
    }
  });
});
