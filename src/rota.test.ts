import { renderValued, when } from "#test/intervals.js";
import { faker } from "@faker-js/faker";
import {
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { dates, weekdays, weekends } from "./build.js";
import { cascade, layer } from "./cascade.js";
import { rota } from "./rota.js";
import { take } from "./stream.js";

describe("a rota", () => {
  const MONDAY = when("2026-03-09T00:00");
  const NEXT_MONDAY = when("2026-03-16T00:00");

  /**
   * Weekdays to one person, weekends to another, and the Wednesday swapped to
   * a third. Fresh names each call, so no test can lean on another's.
   */
  const anOnCallRota = () => {
    const [weekday = "", weekend = "", covering = ""] =
      faker.helpers.uniqueArray(() => faker.person.firstName(), 3);

    return {
      weekday,
      weekend,
      covering,
      onCall: rota()
        .assign(weekdays(), weekday)
        .assign(weekends(), weekend)
        .swap("2026-03-11", covering),
    };
  };

  it("is the cascade it would have been written as by hand", () => {
    // Given a rota built through the domain vocabulary.
    const { weekday, weekend, covering, onCall } = anOnCallRota();

    // When it is compared with the layers spelled out by hand.
    const byHand = cascade(
      layer(weekdays(), weekday),
      layer(weekends(), weekend),
      layer(dates("2026-03-11"), covering),
    );

    // Then the two documents are the same. The vocabulary is a way of writing
    // a cascade, and the stored form carries no trace of which was used.
    assertIdentical(JSON.stringify(onCall), JSON.stringify(byHand));
  });

  it("says who is on", () => {
    // Given the rota.
    const { weekday, weekend, onCall } = anOnCallRota();

    // When it is asked about a Monday morning and a Saturday morning.
    // Then each falls to whoever holds that part of the week.
    assertIdentical(onCall.whoIsOn(when("2026-03-09T10:00")), weekday);
    assertIdentical(onCall.whoIsOn(when("2026-03-14T10:00")), weekend);
  });

  it("gives a swapped day to whoever took it", () => {
    // Given the rota, whose Wednesday has been swapped.
    const { covering, onCall } = anOnCallRota();

    // When it is asked about that Wednesday.
    // Then the swap wins over the weekday cover beneath it.
    assertIdentical(onCall.whoIsOn(when("2026-03-11T10:00")), covering);
  });

  it("says nobody when nothing covers the moment", () => {
    // Given a rota that only covers weekdays.
    const weekdaysOnly = rota().assign(weekdays(), faker.person.firstName());

    // When it is asked about a Saturday.
    // Then nobody is on. An unassigned moment has no value to give.
    assertUndefined(weekdaysOnly.whoIsOn(when("2026-03-14T10:00")));
  });

  it("hands back each stretch and who has it", () => {
    // Given the rota.
    const { weekday, weekend, covering, onCall } = anOnCallRota();

    // When a week of shifts is read off it.
    const week = onCall.shifts(MONDAY, NEXT_MONDAY);

    // Then the week arrives in four stretches, split where the swap falls.
    assertIdentical(
      renderValued(week),
      `[2026-03-09T00:00:00,2026-03-11T00:00:00)=${weekday} ` +
        `[2026-03-11T00:00:00,2026-03-12T00:00:00)=${covering} ` +
        `[2026-03-12T00:00:00,2026-03-14T00:00:00)=${weekday} ` +
        `[2026-03-14T00:00:00,2026-03-16T00:00:00)=${weekend}`,
    );
  });

  it("runs on for as long as it is asked to", () => {
    // Given a weekday rota and no end to read it up to.
    const name = faker.person.firstName();
    const rolling = rota().assign(weekdays(), name);
    const shifts = rolling.shifts(MONDAY);

    // When two shifts are taken. Taking is what stops it.
    const fortnight = take(shifts, 2);

    // Then they are this week's and next week's.
    assertIdentical(
      renderValued(fortnight),
      `[2026-03-09T00:00:00,2026-03-14T00:00:00)=${name} ` +
        `[2026-03-16T00:00:00,2026-03-21T00:00:00)=${name}`,
    );
  });

  describe("the value type", () => {
    it("narrows to the names actually assigned", () => {
      // Given a rota whose names are written as literals. They stay literals
      // here because the type is what this test is about, and a name from
      // faker would widen to `string` and prove nothing.
      const onCall = rota()
        .assign(weekdays(), "alice")
        .assign(weekends(), "bob");

      // When someone is read off it.
      // Then the type is the union of the two names, so a switch over it can
      // be exhaustive. The annotation is the assertion, checked by the
      // compiler.
      const who: "alice" | "bob" | undefined = onCall.whoIsOn(MONDAY);

      assertIdentical(who, "alice");
    });

    it("takes a declared type when the values are not known up front", () => {
      // Given a roster of how many people are working, declared as numbers.
      const count = faker.number.int({ min: 1, max: 12 });
      const staffing = rota<number>().assign(weekdays(), count);

      // When a weekday is read.
      const many: number | undefined = staffing.whoIsOn(
        when("2026-03-09T10:00"),
      );

      // Then the count comes back at the declared type.
      assertIdentical(many, count);
    });
  });

  describe("what it refuses", () => {
    it("says so when a day is not a date", () => {
      // Given a swap written the way someone would say it out loud.
      const said = "next Tuesday";

      // When the swap is added.
      const error = assertThrowsError(() =>
        rota().swap(said, faker.person.firstName()),
      );

      // Then it is refused where it was written.
      assertInstanceOf(error, RangeError);
    });
  });
});
