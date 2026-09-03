import {
  assertFalse,
  assertIdentical,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { faker } from "@faker-js/faker";
import { describe, it } from "vitest";

import { assigned, nextValue, valueAt } from "./assigned.js";
import { all, dates, timeOfDay, weekdays, weekends } from "./build.js";
import { cascade, layer } from "./cascade.js";
import type { Context } from "./context.js";
import {
  activeAt,
  advanceBy,
  coveredDuration,
  nextCoveredInterval,
} from "./query.js";
import { schedule } from "./schedule.js";

describe("asking the four questions of a cascade", () => {
  /** An on-call rota with a swap in the middle of it. */
  const alice = faker.person.firstName();
  const bob = faker.person.firstName();
  const carol = faker.person.firstName();

  const onCall = cascade(
    layer(weekdays(), alice),
    layer(weekends(), bob),
    layer(dates("2026-03-11"), carol),
  );

  const week: Context = {
    from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
    to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
  };

  describe("valueAt", () => {
    it("says who is on", () => {
      // Given a Monday and the Wednesday somebody swapped onto.
      const monday = Temporal.ZonedDateTime.from(
        "2026-03-09T11:00[Europe/London]",
      );
      const wednesday = Temporal.ZonedDateTime.from(
        "2026-03-11T11:00[Europe/London]",
      );

      // When each is asked of the rota.
      // Then the swap outranks the weekdays it sits on top of.
      assertIdentical(valueAt(onCall, monday), alice);
      assertIdentical(valueAt(onCall, wednesday), carol);
    });

    it("says nothing where no layer claims the moment", () => {
      // Given a rota covering weekdays only.
      const weekdaysOnly = cascade(layer(weekdays(), alice));
      const saturday = Temporal.ZonedDateTime.from(
        "2026-03-14T11:00[Europe/London]",
      );

      // When a Saturday is asked of it.
      // Then the answer is nothing at all rather than some empty value.
      assertUndefined(valueAt(weekdaysOnly, saturday));
    });
  });

  describe("nextValue", () => {
    it("gives the next stretch and what it carries", () => {
      // Given a Tuesday evening, with the swap starting at midnight.
      const tuesday = Temporal.ZonedDateTime.from(
        "2026-03-10T20:00[Europe/London]",
      );

      // When the rota is asked what happens next.
      const shift = nextValue(onCall, { from: tuesday });

      // Then it is the stretch in progress, clipped to begin where the
      // question was asked, which is what `nextCoveredInterval` does for a rule.
      assertIdentical(shift?.value, alice);
      assertIdentical(shift.start?.toString(), tuesday.toString());
    });
  });

  describe("the four queries, narrowed to one value", () => {
    it("answers whether that value holds at an instant", () => {
      // Given the Wednesday of the swap.
      const wednesday = Temporal.ZonedDateTime.from(
        "2026-03-11T11:00[Europe/London]",
      );

      // When the rota is narrowed to each name in turn.
      // Then only the one actually on call covers the moment.
      assertTrue(activeAt(assigned(onCall, carol), wednesday));
      assertFalse(activeAt(assigned(onCall, alice), wednesday));
    });

    it("counts how much time a value covers", () => {
      // Given the week, in which the swap takes one of Alice's five days.
      // When each name is measured over it.
      // Then the days add up, and the swap has come out of Alice's total.
      assertIdentical(
        coveredDuration(assigned(onCall, alice), week).total("hours"),
        96,
      );
      assertIdentical(
        coveredDuration(assigned(onCall, carol), week).total("hours"),
        24,
      );
      assertIdentical(
        coveredDuration(assigned(onCall, bob), week).total("hours"),
        48,
      );
    });

    it("finds when a value next holds", () => {
      // Given a Monday, and a name that is not on until the Saturday.
      const monday = Temporal.ZonedDateTime.from(
        "2026-03-09T11:00[Europe/London]",
      );

      // When the rota is narrowed to that name and asked for the next stretch.
      const shift = nextCoveredInterval(assigned(onCall, bob), {
        from: monday,
      });

      // Then the search skips the days somebody else has.
      assertIdentical(shift?.start?.toPlainDate().toString(), "2026-03-14");
    });

    it("advances through time only one value covers", () => {
      // Given a shift that only counts while Alice is on, running out of her
      // Tuesday and into her Thursday, because Wednesday belongs to the swap.
      const tuesday = Temporal.ZonedDateTime.from(
        "2026-03-10T20:00[Europe/London]",
      );

      // When eight hours of it are worked through.
      const done = advanceBy(tuesday, Temporal.Duration.from({ hours: 8 }), {
        during: assigned(onCall, alice),
      });

      // Then the Wednesday is skipped entirely, which is the whole point of
      // asking a query of a cascade rather than of a clock.
      assertIdentical(
        done?.toString(),
        "2026-03-12T04:00:00+00:00[Europe/London]",
      );
    });
  });

  describe("a schedule read the same way", () => {
    it("answers a root query directly", () => {
      // Given a schedule façade and a Monday inside its opening hours.
      const office = schedule().open(weekdays(), "09:00-17:00");
      const monday = Temporal.ZonedDateTime.from(
        "2026-03-09T11:00[Europe/London]",
      );

      // When the generic active-at query reads the façade.
      const open = activeAt(office, monday);

      // Then it reads the schedule's boolean cascade.
      assertTrue(open);
    });

    it("advances through opening hours held in a cascade", () => {
      // Given opening hours as a cascade of `true`, which is what a schedule
      // is underneath.
      const officeHours = all(weekdays(), timeOfDay("09:00", "17:00"));
      const openingHours = cascade(layer(officeHours, true));

      // When three hours of packing are worked from five to five on a Friday.
      const placed = Temporal.ZonedDateTime.from(
        "2026-03-13T16:55[Europe/London]",
      );
      const packed = advanceBy(placed, Temporal.Duration.from({ hours: 3 }), {
        during: assigned(openingHours, true),
      });

      // Then it lands where the same question asked of the rule lands. A
      // cascade narrowed to one value is a stretch of when, and nothing about
      // the query changes.
      assertIdentical(
        packed?.toString(),
        "2026-03-16T11:55:00+00:00[Europe/London]",
      );
    });
  });
});
