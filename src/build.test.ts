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

describe("the builder", () => {
  /** Monday 2026-03-09 to the Monday after it. */
  const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

  /** Keeps an assertion about the rule and off the plumbing. */
  const read = (rule: Rule, context = WEEK): string =>
    render(intervals(rule, context));

  describe("a built rule", () => {
    it("is the document it stands for, with the methods left out", () => {
      // Given office hours built through the fluent form.
      const rule = weekdays().and(timeOfDay("09:00", "17:00"));

      // When it is serialised.
      // Then out comes the object literal it stands for. JSON.stringify drops
      // the methods, and that is the whole of the trick.
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
      // Given the same rule.
      const rule = weekdays().and(timeOfDay("09:00", "17:00"));

      // When its type tag is read.
      // Then it is the literal `"all"` and not `string`, so an interpreter can
      // narrow on it. The annotation is the assertion.
      const type: "all" = rule.type;

      assertIdentical(type, "all");
    });

    it("satisfies Rule without being converted out of anything", () => {
      // Given a built rule assigned straight to the plain type.
      // When its tag is read.
      // Then it holds, with no build step in between.
      const rule: Rule = weekends();

      assertIdentical(rule.type, "daysOfWeek");
    });

    it("survives a round trip through JSON unchanged", () => {
      // Given a built rule, stored and read back through the parser.
      const built = weekdays().and(timeOfDay("09:00", "17:00"));
      const parsed = parseRule(JSON.parse(JSON.stringify(built)));

      // When both are read over the same week.
      // Then they cover the same time. Storing a rule loses nothing.
      assertIdentical(read(parsed), read(built));
    });
  });

  describe("combining", () => {
    it("ands", () => {
      // Given weekdays intersected with office hours.
      // When the week is read.
      const days = read(weekdays().and(timeOfDay("09:00", "17:00"))).split(" ");

      // Then five working days come back, one per weekday.
      assertArrayLength(days, 5);
    });

    it("ors", () => {
      // Given the weekend and one midweek day.
      const midweek = dates("2026-03-11");

      // When the union is read.
      // Then the Wednesday and the weekend both appear, apart from each other.
      assertIdentical(
        read(weekends().or(midweek)),
        "[2026-03-11T00:00:00,2026-03-12T00:00:00) " +
          "[2026-03-14T00:00:00,2026-03-16T00:00:00)",
      );
    });

    it("excepts, which is the shape a schedule with holidays actually has", () => {
      // Given office hours with one day taken out of them.
      const open = weekdays()
        .and(timeOfDay("09:00", "17:00"))
        .except(dates("2026-03-11"));

      // When the week is read.
      // Then four days remain and the Wednesday is gone entirely.
      assertIdentical(
        read(open),
        "[2026-03-09T09:00:00,2026-03-09T17:00:00) " +
          "[2026-03-10T09:00:00,2026-03-10T17:00:00) " +
          "[2026-03-12T09:00:00,2026-03-12T17:00:00) " +
          "[2026-03-13T09:00:00,2026-03-13T17:00:00)",
      );
    });

    it("excepts nothing when given nothing to except", () => {
      // Given a weekend rule and an exception list that came out empty.
      // When it is read.
      // Then the weekend is untouched, which is what makes building from a
      // filtered list safe.
      assertIdentical(
        read(weekends().except()),
        "[2026-03-14T00:00:00,2026-03-16T00:00:00)",
      );
    });

    it("builds the identities", () => {
      // Given the four rules that cover everything or nothing.
      // When each is read over the week.
      // Then `always` and an empty `all` give the whole window, while `never`
      // and an empty `any` give none of it.
      assertIdentical(read(always()), "[2026-03-09T00:00:00,2026-03-16T00:00:00)");
      assertIdentical(read(never()), "");
      assertIdentical(read(all()), "[2026-03-09T00:00:00,2026-03-16T00:00:00)");
      assertIdentical(read(any()), "");
    });

    it("negates", () => {
      // Given the weekend.
      // When its complement is read over the week.
      // Then the five weekdays come back as one stretch, clipped to the window.
      assertIdentical(
        read(not(weekends())),
        "[2026-03-09T00:00:00,2026-03-14T00:00:00)",
      );
    });

    it("names a zone for a leaf", () => {
      // Given London office hours, read from a Tokyo day. London is nine hours
      // behind in March.
      const tokyo = inWindow("2026-03-09T00:00", "2026-03-10T00:00", "Asia/Tokyo");
      const london = inZone(timeOfDay("09:00", "17:00"), "Europe/London");

      // When the rule is serialised, and read over that day.
      // Then the zone is in the document, and the Tokyo day catches the tail of
      // one London working day and the head of the next.
      assertStringIncludes(JSON.stringify(london), '"zone":"Europe/London"');
      assertIdentical(
        read(london, tokyo),
        "[2026-03-09T00:00:00,2026-03-09T02:00:00) " +
          "[2026-03-09T18:00:00,2026-03-10T00:00:00)",
      );
    });

    it("takes a zone as an argument too", () => {
      // Given hours built with the zone passed in rather than added after.
      // When the rule is serialised.
      // Then the document is the same either way.
      assertIdentical(
        JSON.stringify(timeOfDay("09:00", "17:00", "Europe/London")),
        '{"type":"timeOfDay","from":"09:00","to":"17:00","zone":"Europe/London"}',
      );
    });

    it("leaves the zone out entirely when there is not one", () => {
      // Given hours built with no zone.
      // When the rule is serialised.
      // Then the field is absent. A present `undefined` would vanish through
      // JSON anyway, and would make two equivalent rules compare as different
      // documents on the way in.
      assertIdentical(
        JSON.stringify(timeOfDay("09:00", "17:00")),
        '{"type":"timeOfDay","from":"09:00","to":"17:00"}',
      );
    });

    it("nests without limit", () => {
      // Given two days unioned, narrowed to a morning window, with one of the
      // days then excepted out.
      const rule = daysOfWeek("monday")
        .or(daysOfWeek("wednesday"))
        .and(timeOfDay("09:00", "12:00"))
        .except(dates("2026-03-09"));

      // When it is read.
      // Then only the Wednesday morning survives all three steps.
      assertIdentical(read(rule), "[2026-03-11T09:00:00,2026-03-11T12:00:00)");
    });
  });
});
