import { when } from "#test/intervals.js";
import {
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertNonNullable,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { all, atMost, atMostTime, spacedBy, weekdays } from "./build.js";
import { MissingOccurrencesError, type Occurrence } from "./occurrence.js";
import { admits, type Breach, firstBreach } from "./plan.js";
import type { Rule } from "./rule.js";

describe("checking a whole plan", () => {
  /** At most four a day, four hours apart. */
  const dosing = (): Rule => all(atMost(4, "days"), spacedBy("PT4H"));

  /** Doses on one day, from times of day. */
  const doses = (hours: readonly string[]): Occurrence[] =>
    hours.map((hour) => ({ at: when(`2026-03-10T${hour}`) }));

  describe("the plan counts itself", () => {
    it("admits a plan that stays inside the rule", () => {
      // Given four doses spread through a day, and nothing taken yet.
      const plan = doses(["08:00", "12:00", "16:00", "20:00"]);

      // When the whole plan is checked.
      // Then nothing in it is refused.
      assertUndefined(firstBreach(dosing(), plan, { occurrences: [] }));
    });

    it("refuses the one that tips it over, counting the plan's own", () => {
      // Given five doses in a day against a cap of four, and nothing taken.
      // Asking the rule about each of them separately would admit all five,
      // because none of them would count the others.
      const plan = doses(["08:00", "12:00", "16:00", "20:00", "23:59"]);

      // When the whole plan is checked.
      const breach = firstBreach(dosing(), plan, { occurrences: [] });

      // Then the fifth is refused, and the account names the four before it.
      assertNonNullable(breach);
      assertIdentical(breach.index, 4);
      assertStringIncludes(
        breach.explanation.description,
        "already 4 occurrences in this day",
      );
    });

    it("refuses one planned too close to another planned", () => {
      // Given two doses an hour apart, which is closer than the rule allows.
      const plan = doses(["08:00", "09:00"]);

      // When the plan is checked.
      const breach = firstBreach(dosing(), plan, { occurrences: [] });

      // Then the second is refused against the first, which is also planned
      // and not yet taken.
      assertNonNullable(breach);
      assertIdentical(breach.index, 1);
      assertStringIncludes(
        breach.explanation.description,
        "1 hour away, which is closer than the 4 hours allowed",
      );
    });

    it("counts what has already happened as well", () => {
      // Given three doses already taken and two more planned.
      const taken = doses(["08:00", "12:00", "16:00"]);
      const plan = doses(["20:00", "23:00"]);

      // When the plan is checked against that history.
      const breach = firstBreach(dosing(), plan, { occurrences: taken });

      // Then the second planned dose is the fifth of the day, and refused.
      assertNonNullable(breach);
      assertIdentical(breach.index, 1);
    });
  });

  describe("the order the plan arrives in", () => {
    it("reads it in time order and reports where it was given", () => {
      // Given three doses listed out of order, two of them an hour apart.
      const plan = doses(["20:00", "08:00", "09:00"]);

      // When the plan is checked.
      const breach = firstBreach(dosing(), plan, { occurrences: [] });

      // Then the nine o'clock one is refused against the eight o'clock one,
      // and it is named by where it sits in the list as given.
      assertNonNullable(breach);
      assertIdentical(breach.index, 2);
      assertIdentical(breach.at.toPlainTime().toString(), "09:00:00");
    });

    it("admits an empty plan", () => {
      // Given nothing planned at all.
      // When it is checked.
      // Then there is nothing to refuse.
      assertTrue(admits(dosing(), [], { occurrences: [] }));
    });
  });

  describe("occurrences that last", () => {
    it("refuses the instant inside one that runs into closed time", () => {
      // Given a three-day booking opening on a Friday, against weekdays only.
      const plan: Occurrence[] = [
        {
          at: when("2026-03-13T00:00"),
          lasting: Temporal.Duration.from({ days: 3 }),
        },
      ];

      // When the plan is checked.
      const breach = firstBreach(weekdays(), plan, {});

      // Then it is refused at the Saturday it runs into, rather than at the
      // Friday it opens on.
      assertNonNullable(breach);
      assertIdentical(breach.index, 0);
      assertIdentical(breach.at.toPlainDate().toString(), "2026-03-14");
    });

    it("counts a trip against an allowance day by day", () => {
      // Given eighty-five days of the Schengen allowance already used, and a
      // ten-day trip planned after them.
      const utc = (iso: string): Temporal.ZonedDateTime =>
        Temporal.ZonedDateTime.from(`${iso}[UTC]`);
      const daysFrom = (from: string, count: number): Occurrence[] =>
        Array.from({ length: count }, (_, index) => ({
          at: utc(from).add({ days: index }),
          lasting: Temporal.Duration.from({ days: 1 }),
        }));

      // When the trip is checked against the allowance.
      const breach = firstBreach(
        atMostTime("P90D", "P180D"),
        daysFrom("2026-04-01T00:00", 10),
        { occurrences: daysFrom("2026-01-01T00:00", 85) },
      );

      // Then the sixth day of it is the ninety-first, and refused.
      assertNonNullable(breach);
      assertIdentical(breach.index, 5);
      assertIdentical(breach.at.toPlainDate().toString(), "2026-04-06");
      assertStringIncludes(
        breach.explanation.description,
        "90 days of the 180 days up to this instant is already taken up",
      );
    });
  });

  describe("what it needs to answer", () => {
    it("refuses to check a constraint with no history at all", () => {
      // Given a plan checked against a rule that counts what has happened,
      // with nothing said about what has.
      const asking = (): Breach | undefined =>
        firstBreach(dosing(), doses(["08:00"]));

      // Then it refuses, the way every constraint does.
      assertInstanceOf(assertThrowsError(asking), MissingOccurrencesError);
    });

    it("says plainly whether a plan holds", () => {
      // Given one plan that fits and one that does not.
      const fits = doses(["08:00", "12:00"]);
      const spills = doses(["08:00", "09:00"]);

      // When each is asked about as a yes or no.
      // Then the answer is the one the breach would have given.
      assertTrue(admits(dosing(), fits, { occurrences: [] }));
      assertFalse(admits(dosing(), spills, { occurrences: [] }));
    });
  });
});
