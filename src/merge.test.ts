import {
  assertArrayEquals,
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
} from "@kensio/smartass";
import { faker } from "@faker-js/faker";
import { describe, it } from "vitest";

import { all, dates, daysOfWeek, timeOfDay, weekdays } from "./build.js";
import { type Cascade, cascade, layer, merged, replace } from "./cascade.js";
import type { Context } from "./context.js";
import { resolve } from "./resolve.js";
import { take } from "./stream.js";

describe("merging values that overlap", () => {
  /** A week, which every example here is read over. */
  const week: Context = {
    from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
    to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
  };

  /** Each stretch a cascade assigns, as `date value` lines. */
  const assigned = <V>(of: Cascade<V>): string[] =>
    [...resolve(of, week)].map((span) => {
      const day = span.start?.toPlainDate().toString() ?? "";
      const value =
        typeof span.value === "string"
          ? span.value
          : JSON.stringify(span.value);
      return `${day} ${value}`;
    });

  describe("sum", () => {
    it("adds where two layers claim the same day", () => {
      // Given two teams staffing the same week, one on weekdays and one on the
      // Wednesday only. Under precedence the Wednesday would show the second
      // team alone, and the question a roster asks is how many are in.
      const staff = merged(
        "sum",
        layer(weekdays(), 3),
        layer(dates("2026-03-11"), 2),
      );

      // When the week is resolved.
      // Then the Wednesday carries both teams, and the other days carry one.
      assertArrayEquals(assigned(staff), [
        "2026-03-09 3",
        "2026-03-11 5",
        "2026-03-12 3",
      ]);
    });

    it("leaves a day no layer claims out of the answer", () => {
      // Given a roster covering weekdays only.
      const staff = merged("sum", layer(weekdays(), 1));

      // When a weekend is resolved.
      const weekend: Context = {
        from: Temporal.ZonedDateTime.from("2026-03-14T00:00[Europe/London]"),
        to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
      };

      // Then nothing comes back. A merge changes what an overlap means and
      // leaves the rest of the model alone, so an unclaimed moment is still
      // absent rather than a sum of nothing.
      assertIdentical([...resolve(staff, weekend)].length, 0);
    });

    it("adds three layers over the same stretch", () => {
      // Given three layers all claiming the Monday, which is the case a fold
      // gets wrong if it only ever looks at two.
      const monday = dates("2026-03-09");
      const staff = merged(
        "sum",
        layer(monday, 1),
        layer(monday, 2),
        layer(monday, 4),
      );

      // When the week is resolved.
      // Then all three are in the total.
      assertArrayEquals(assigned(staff), ["2026-03-09 7"]);
    });
  });

  describe("max and min", () => {
    it("takes the higher of two overlapping rates", () => {
      // Given a standing rate all week and a peak rate on one day.
      const tariff = merged(
        "max",
        layer(weekdays(), 12),
        layer(dates("2026-03-11"), 30),
      );

      // When the week is resolved.
      // Then the peak day carries the peak rate and the rest carry the
      // standing one.
      assertArrayEquals(assigned(tariff), [
        "2026-03-09 12",
        "2026-03-11 30",
        "2026-03-12 12",
      ]);
    });

    it("takes the lower", () => {
      // Given the same two layers under `min`, which is the discount question
      // rather than the peak one.
      const tariff = merged(
        "min",
        layer(weekdays(), 12),
        layer(dates("2026-03-11"), 30),
      );

      // When the week is resolved.
      // Then the cheaper of the two holds on the overlapping day, and it
      // coalesces with the days either side because the value is the same.
      assertArrayEquals(assigned(tariff), ["2026-03-09 12"]);
    });
  });

  describe("concat", () => {
    it("collects everyone claiming a moment", () => {
      // Given a rota where two people can be on at once, with each layer
      // carrying a list rather than a name.
      const alice = faker.person.firstName();
      const bob = faker.person.firstName();
      const onCall = merged(
        "concat",
        layer(weekdays(), [alice]),
        layer(dates("2026-03-11"), [bob]),
      );

      // When the week is resolved.
      // Then the Wednesday has both of them, in layer order.
      assertArrayEquals(assigned(onCall), [
        `2026-03-09 ${JSON.stringify([alice])}`,
        `2026-03-11 ${JSON.stringify([alice, bob])}`,
        `2026-03-12 ${JSON.stringify([alice])}`,
      ]);
    });
  });

  describe("override, which is what a cascade says when it says nothing", () => {
    it("gives the same answers named as it does left out", () => {
      // Given the same two layers built both ways.
      const layers = [
        layer(weekdays(), "alice"),
        layer(dates("2026-03-11"), "bob"),
      ] as const;
      const silent = cascade(...layers);
      const named = merged("override", ...layers);

      // When each is resolved.
      // Then they agree. A document written before merging existed means what
      // it always did.
      assertArrayEquals(assigned(named), assigned(silent));
      assertArrayEquals(assigned(silent), [
        "2026-03-09 alice",
        "2026-03-11 bob",
        "2026-03-12 alice",
      ]);
    });
  });

  describe("replacing layers under a merge", () => {
    it("keeps the layers below out of a scope a replacement claims", () => {
      // Given hours that a shorter day replaces on one date. A replacing layer
      // claims its whole scope, and what the replacement leaves out has to
      // stay unassigned rather than falling through to the base hours.
      const fullDay = all(weekdays(), timeOfDay("09:00", "17:00"));
      const shorterDay = timeOfDay("09:00", "15:00");
      const openingHours = merged(
        "override",
        layer(fullDay, true),
        replace(dates("2026-03-11"), shorterDay),
      );

      // When the Wednesday is resolved.
      const wednesday: Context = {
        from: Temporal.ZonedDateTime.from("2026-03-11T00:00[Europe/London]"),
        to: Temporal.ZonedDateTime.from("2026-03-12T00:00[Europe/London]"),
      };
      const open = take(resolve(openingHours, wednesday), 2);

      // Then the day ends at three, and the afternoon the replacement dropped
      // is absent rather than open.
      const hours = open.map((span) => {
        const from = span.start?.toPlainTime().toString() ?? "";
        const to = span.end?.toPlainTime().toString() ?? "";
        return `${from} to ${to}`;
      });
      assertArrayEquals(hours, ["09:00:00 to 15:00:00"]);
    });

    it("still adds a layer sitting above a replacement", () => {
      // Given a replacement, and a layer above it claiming the same day. The
      // replacement outranks what is below it and nothing more.
      const wednesday = dates("2026-03-11");
      const shorthanded = cascade(layer(wednesday, 1));
      const staff = merged(
        "sum",
        layer(weekdays(), 3),
        replace(wednesday, shorthanded),
        layer(wednesday, 4),
      );

      // When the week is resolved.
      // Then the Wednesday holds the replacement plus the layer above it, with
      // the base three excluded by the replacement.
      assertArrayEquals(assigned(staff), [
        "2026-03-09 3",
        "2026-03-11 5",
        "2026-03-12 3",
      ]);
    });
  });

  describe("refusing values a strategy cannot combine", () => {
    it("says so when a sum is handed names", () => {
      // Given a cascade merging by sum whose layers carry names, which the
      // document's vocabulary alone cannot rule out.
      const onCall: Cascade<string> = {
        type: "cascade",
        merge: "sum",
        layers: [layer(weekdays(), "alice"), layer(dates("2026-03-11"), "bob")],
      };

      // When it is resolved.
      const error = assertThrowsError(() => [...resolve(onCall, week)]);

      // Then it throws where the values are seen rather than adding the two
      // strings together, and the message says what to do about it.
      assertInstanceOf(error, TypeError);
      assertIdentical(
        error.message,
        'A cascade merging by "sum" carries numbers, and this one holds ' +
          'string. Give it values it can combine, or merge by "override".',
      );
    });

    it("says so when concat is handed something that is not a list", () => {
      // Given layers carrying bare names where `concat` needs lists.
      const onCall: Cascade<string> = {
        type: "cascade",
        merge: "concat",
        layers: [layer(weekdays(), "alice"), layer(dates("2026-03-11"), "bob")],
      };

      // When it is resolved.
      const error = assertThrowsError(() => [...resolve(onCall, week)]);

      // Then the complaint names the strategy and what it holds.
      assertIdentical(
        error.message,
        'A cascade merging by "concat" carries arrays, and this one holds ' +
          'string. Give it values it can combine, or merge by "override".',
      );
    });

    it("names a null the way the parser would", () => {
      // Given a stored roster where one layer's value came back as null,
      // which is what an empty column in a database gives.
      const staff: Cascade<number | null> = {
        type: "cascade",
        merge: "sum",
        layers: [layer(weekdays(), 3), layer(dates("2026-03-11"), null)],
      };

      // When it is resolved.
      const error = assertThrowsError(() => [...resolve(staff, week)]);

      // Then the message says null rather than object, which is what `typeof`
      // alone would have called it.
      assertIdentical(
        error.message,
        'A cascade merging by "sum" carries numbers, and this one holds ' +
          'null. Give it values it can combine, or merge by "override".',
      );
    });

    it("says nothing while the layers never meet", () => {
      // Given a sum over names whose scopes do not overlap. The merge is never
      // called, so there is nothing to complain about.
      const onCall: Cascade<string> = {
        type: "cascade",
        merge: "sum",
        layers: [
          layer(daysOfWeek("monday"), "alice"),
          layer(daysOfWeek("tuesday"), "bob"),
        ],
      };

      // When the week is resolved.
      // Then both layers come through untouched.
      assertArrayEquals(assigned(onCall), [
        "2026-03-09 alice",
        "2026-03-10 bob",
      ]);
    });
  });

  describe("laziness", () => {
    it("answers from an endless cascade without expanding it", () => {
      // Given a roster with no end to the context, which recurs forever.
      const staff = merged(
        "sum",
        layer(weekdays(), 3),
        layer(daysOfWeek("wednesday"), 2),
      );

      // When the first two stretches are taken.
      const endless: Context = { from: week.from };
      const first = take(resolve(staff, endless), 2);

      // Then they arrive rather than the sweep walking the calendar. A merge
      // that had to see every layer's whole stream before answering would
      // never return here.
      assertIdentical(first.length, 2);
      assertIdentical(first[0]?.value, 3);
      assertIdentical(first[1]?.value, 5);
    });
  });
});
