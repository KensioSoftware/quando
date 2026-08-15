import { inWindow, render } from "#test/intervals.js";
import {
  assertArrayLength,
  assertIdentical,
  assertStringIncludes,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  all,
  always,
  any,
  dates,
  daysOfWeek,
  inZone,
  never,
  not,
  timeOfDay,
  weekdays,
  weekends,
} from "./build.js";
import { intervals } from "./interpret.js";
import { parseRule } from "./parse.js";
import type { Rule } from "./rule.js";

const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

/** Keeps the assertions about the rule rather than about the plumbing. */
const read = (rule: Rule, context = WEEK): string =>
  render(intervals(rule, context));

describe("a built rule", () => {
  it("is the document it stands for, with the methods left out", () => {
    const rule = weekdays().and(timeOfDay("09:00", "17:00"));

    assertIdentical(
      JSON.stringify(rule),
      JSON.stringify({
        type: "all",
        rules: [
          {
            type: "daysOfWeek",
            days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          },
          { type: "timeOfDay", from: "09:00", to: "17:00" },
        ],
      }),
    );
  });

  it("keeps its literal type through the builder", () => {
    // Not `string`: the node knows what it is, so an interpreter narrows on it.
    const rule = weekdays().and(timeOfDay("09:00", "17:00"));
    const type: "all" = rule.type;
    assertIdentical(type, "all");
  });

  it("satisfies Rule without being converted out of anything", () => {
    const rule: Rule = weekends();
    assertIdentical(rule.type, "daysOfWeek");
  });

  it("survives a round trip through JSON unchanged", () => {
    const built = weekdays().and(timeOfDay("09:00", "17:00"));
    const document = JSON.stringify(built);
    const parsed = parseRule(JSON.parse(document));

    assertIdentical(read(parsed), read(built));
  });
});

describe("combining", () => {
  it("ands", () => {
    const days = read(weekdays().and(timeOfDay("09:00", "17:00"))).split(" ");
    assertArrayLength(days, 5);
  });

  it("ors", () => {
    const christmasEve = dates("2026-03-11");
    assertIdentical(
      read(weekends().or(christmasEve)),
      "[2026-03-11T00:00:00,2026-03-12T00:00:00) " +
        "[2026-03-14T00:00:00,2026-03-16T00:00:00)",
    );
  });

  it("excepts, which is the shape a schedule with holidays actually has", () => {
    const open = weekdays()
      .and(timeOfDay("09:00", "17:00"))
      .except(dates("2026-03-11"));

    assertIdentical(
      read(open),
      "[2026-03-09T09:00:00,2026-03-09T17:00:00) " +
        "[2026-03-10T09:00:00,2026-03-10T17:00:00) " +
        "[2026-03-12T09:00:00,2026-03-12T17:00:00) " +
        "[2026-03-13T09:00:00,2026-03-13T17:00:00)",
    );
  });

  it("excepts nothing when given nothing to except", () => {
    assertIdentical(
      read(weekends().except()),
      "[2026-03-14T00:00:00,2026-03-16T00:00:00)",
    );
  });

  it("builds the identities", () => {
    assertIdentical(
      read(always()),
      "[2026-03-09T00:00:00,2026-03-16T00:00:00)",
    );
    assertIdentical(read(never()), "");
    assertIdentical(read(all()), "[2026-03-09T00:00:00,2026-03-16T00:00:00)");
    assertIdentical(read(any()), "");
  });

  it("negates", () => {
    const theWeekend = weekends();
    assertIdentical(
      read(not(theWeekend)),
      "[2026-03-09T00:00:00,2026-03-14T00:00:00)",
    );
  });

  it("names a zone for a leaf", () => {
    const tokyo = inWindow(
      "2026-03-09T00:00",
      "2026-03-10T00:00",
      "Asia/Tokyo",
    );
    const london = inZone(timeOfDay("09:00", "17:00"), "Europe/London");

    assertStringIncludes(JSON.stringify(london), '"zone":"Europe/London"');
    // A Tokyo day catches the tail of one London working day and the head of
    // the next, because London is nine hours behind in March.
    assertIdentical(
      read(london, tokyo),
      "[2026-03-09T00:00:00,2026-03-09T02:00:00) " +
        "[2026-03-09T18:00:00,2026-03-10T00:00:00)",
    );
  });

  it("takes a zone as an argument too", () => {
    assertIdentical(
      JSON.stringify(timeOfDay("09:00", "17:00", "Europe/London")),
      '{"type":"timeOfDay","from":"09:00","to":"17:00","zone":"Europe/London"}',
    );
  });

  it("leaves the zone out entirely when there is not one", () => {
    // Not `"zone": undefined`, which would not survive JSON and would make two
    // equivalent rules compare as different documents.
    assertIdentical(
      JSON.stringify(timeOfDay("09:00", "17:00")),
      '{"type":"timeOfDay","from":"09:00","to":"17:00"}',
    );
  });

  it("nests without limit", () => {
    const rule = daysOfWeek("monday")
      .or(daysOfWeek("wednesday"))
      .and(timeOfDay("09:00", "12:00"))
      .except(dates("2026-03-09"));

    assertIdentical(read(rule), "[2026-03-11T09:00:00,2026-03-11T12:00:00)");
  });
});
