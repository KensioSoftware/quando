import { inWindow, renderValued, when } from "#test/intervals.js";
import { faker } from "@faker-js/faker";
import { assertArrayLength, assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  all,
  always,
  dates,
  daysOfWeek,
  timeOfDay,
  weekdays,
} from "./build.js";
import { type Cascade, cascade, layer, replace, whenever } from "./cascade.js";
import type { Context } from "./context.js";
import { resolve } from "./resolve.js";
import { take } from "./stream.js";

describe("resolving a cascade", () => {
  /** Monday 2026-03-09 to the Monday after it. */
  const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

  const WEDNESDAY = dates("2026-03-11");

  const read = <V>(assigned: Cascade<V>, context: Context = WEEK): string =>
    renderValued(resolve(assigned, context));

  /** People who are certainly not each other. */
  const names = (count: number): string[] =>
    faker.helpers.uniqueArray(() => faker.person.firstName(), count);

  describe("a cascade of one layer", () => {
    it("assigns its value across its scope", () => {
      // Given one layer covering one day.
      const [who = ""] = names(1);
      const rota = cascade(layer(WEDNESDAY, who));

      // When the week is resolved.
      // Then that day carries the value and the rest is unassigned.
      assertIdentical(
        read(rota),
        `[2026-03-11T00:00:00,2026-03-12T00:00:00)=${who}`,
      );
    });

    it("assigns nothing where no layer claims", () => {
      // Given a layer whose scope covers no time.
      const rota = cascade(layer({ type: "never" }, faker.person.firstName()));

      // When the week is resolved.
      // Then the stream is empty. There is no value for an unclaimed moment.
      assertIdentical(read(rota), "");
    });

    it("assigns nothing at all when there are no layers", () => {
      // Given a cascade built from a list that came out empty.
      // When the week is resolved.
      // Then nothing is assigned, which is the identity for this shape.
      assertIdentical(read(cascade<string>()), "");
    });
  });

  describe("precedence", () => {
    it("gives a moment to the last layer that claims it", () => {
      // Given weekday cover with one day handed to someone else above it.
      const [weekday = "", midweek = ""] = names(2);
      const rota = cascade(
        layer(weekdays(), weekday),
        layer(WEDNESDAY, midweek),
      );

      // When the week is resolved.
      // Then the Wednesday goes to the upper layer, and the days either side
      // stay with the lower one.
      assertIdentical(
        read(rota),
        `[2026-03-09T00:00:00,2026-03-11T00:00:00)=${weekday} ` +
          `[2026-03-11T00:00:00,2026-03-12T00:00:00)=${midweek} ` +
          `[2026-03-12T00:00:00,2026-03-14T00:00:00)=${weekday}`,
      );
    });

    it("is decided by order, not by how specific a scope is", () => {
      // Given the same two layers the other way round, with the broad one on
      // top of the narrow one.
      const [weekday = "", midweek = ""] = names(2);
      const rota = cascade(
        layer(WEDNESDAY, midweek),
        layer(weekdays(), weekday),
      );

      // When the week is resolved.
      // Then the broad layer takes the whole run, Wednesday included. Anyone
      // expecting the most specific scope to win will find this surprising,
      // which is why the order is the meaning.
      assertIdentical(
        read(rota),
        `[2026-03-09T00:00:00,2026-03-14T00:00:00)=${weekday}`,
      );
    });

    it("lets a higher layer cut a hole rather than replace a whole run", () => {
      // Given weekday cover with one lunch hour handed to someone else.
      const [weekday = "", atLunch = ""] = names(2);
      const lunch = all(WEDNESDAY, timeOfDay("12:00", "13:00"));
      const rota = cascade(layer(weekdays(), weekday), layer(lunch, atLunch));

      // When the week is resolved.
      // Then the run is split in three around the hour.
      assertIdentical(
        read(rota),
        `[2026-03-09T00:00:00,2026-03-11T12:00:00)=${weekday} ` +
          `[2026-03-11T12:00:00,2026-03-11T13:00:00)=${atLunch} ` +
          `[2026-03-11T13:00:00,2026-03-14T00:00:00)=${weekday}`,
      );
    });

    it("takes the topmost of three overlapping claims", () => {
      // Given three layers claiming the Wednesday, each above the last.
      const [weekday = "", second = "", third = ""] = names(3);
      const midweek = dates("2026-03-11", "2026-03-12");
      const rota = cascade(
        layer(weekdays(), weekday),
        layer(WEDNESDAY, second),
        layer(midweek, third),
      );

      // When the week is resolved.
      // Then only the top layer shows on the days it claims. The middle one is
      // covered over entirely.
      assertIdentical(
        read(rota),
        `[2026-03-09T00:00:00,2026-03-11T00:00:00)=${weekday} ` +
          `[2026-03-11T00:00:00,2026-03-13T00:00:00)=${third} ` +
          `[2026-03-13T00:00:00,2026-03-14T00:00:00)=${weekday}`,
      );
    });
  });

  describe("coalescing", () => {
    it("joins touching intervals that carry the same value", () => {
      // Given two layers assigning one person, over days that meet at midnight.
      const [who = ""] = names(1);
      const early = daysOfWeek("monday", "tuesday");
      const rota = cascade(
        layer(early, who),
        layer(daysOfWeek("wednesday"), who),
      );

      // When the week is resolved.
      // Then one stretch comes back. The seam between the layers is not a
      // boundary in the answer, and reporting it as one would break the
      // coalesced contract.
      assertIdentical(
        read(rota),
        `[2026-03-09T00:00:00,2026-03-12T00:00:00)=${who}`,
      );
    });

    it("keeps touching intervals apart when their values differ", () => {
      // Given two adjacent days assigned to two people.
      const [monday = "", tuesday = ""] = names(2);
      const rota = cascade(
        layer(daysOfWeek("monday"), monday),
        layer(daysOfWeek("tuesday"), tuesday),
      );

      // When the week is resolved.
      // Then the midnight between them is a real boundary.
      assertIdentical(
        read(rota),
        `[2026-03-09T00:00:00,2026-03-10T00:00:00)=${monday} ` +
          `[2026-03-10T00:00:00,2026-03-11T00:00:00)=${tuesday}`,
      );
    });

    it("leaves a gap between intervals that do not touch", () => {
      // Given one person on two days with a day between them.
      const [who = ""] = names(1);
      const rota = cascade(
        layer(daysOfWeek("monday"), who),
        layer(daysOfWeek("wednesday"), who),
      );

      // When the week is resolved.
      // Then the two stay apart. Coalescing needs the intervals to meet.
      assertIdentical(
        read(rota),
        `[2026-03-09T00:00:00,2026-03-10T00:00:00)=${who} ` +
          `[2026-03-11T00:00:00,2026-03-12T00:00:00)=${who}`,
      );
    });

    it("joins a run split three ways by an overriding layer", () => {
      // Given an upper layer that wins the Wednesday and assigns what the lower
      // one would have assigned anyway.
      const [who = ""] = names(1);
      const rota = cascade(layer(weekdays(), who), layer(WEDNESDAY, who));

      // When the week is resolved.
      // Then three winning regions come back as one answer.
      assertIdentical(
        read(rota),
        `[2026-03-09T00:00:00,2026-03-14T00:00:00)=${who}`,
      );
    });

    it("merges the same object, and leaves equal-looking ones apart", () => {
      // Given one person as a shared object across two days, and the same
      // person written out twice as two equal objects.
      const monday = daysOfWeek("monday");
      const tuesday = daysOfWeek("tuesday");
      const name = faker.person.firstName();
      const shared = { name };

      const oneObject = cascade(layer(monday, shared), layer(tuesday, shared));
      const twoObjects = cascade(
        layer(monday, { name }),
        layer(tuesday, { name }),
      );

      // When each week is resolved.
      // Then the shared reference merges and the pair of equal objects does
      // not. Sameness is `Object.is`, which splits a mergeable interval rather
      // than merging two a caller meant to keep apart.
      assertArrayLength([...resolve(oneObject, WEEK)], 1);
      assertArrayLength([...resolve(twoObjects, WEEK)], 2);
    });
  });

  describe("a replacing layer", () => {
    /** Weekday office hours, closing at three on the Wednesday. */
    const openingHours = () =>
      cascade(
        layer(all(weekdays(), timeOfDay("09:00", "17:00")), true),
        replace(WEDNESDAY, timeOfDay("09:00", "15:00")),
      );

    it("replaces the hours inside its scope rather than punching a hole", () => {
      // Given the opening hours.
      // When the week is resolved.
      // Then the Wednesday runs to three and the other days to five.
      assertIdentical(
        read(openingHours()),
        "[2026-03-09T09:00:00,2026-03-09T17:00:00)=true " +
          "[2026-03-10T09:00:00,2026-03-10T17:00:00)=true " +
          "[2026-03-11T09:00:00,2026-03-11T15:00:00)=true " +
          "[2026-03-12T09:00:00,2026-03-12T17:00:00)=true " +
          "[2026-03-13T09:00:00,2026-03-13T17:00:00)=true",
      );
    });

    it("does not let the layers below show through what it left unassigned", () => {
      // Given the two hours on the Wednesday between the early closing and the
      // usual one. The base hours run through them.
      const afterClosing = inWindow("2026-03-11T15:00", "2026-03-12T00:00");

      // When just those hours are resolved.
      // Then nothing is assigned. Claiming the scope is what keeps the base
      // hours out, and it is the whole point of a replacing layer.
      assertArrayLength([...resolve(openingHours(), afterClosing)], 0);
    });

    it("blanks its scope when it replaces with a cascade of nothing", () => {
      // Given a layer that claims the Wednesday and puts nothing inside it.
      const [who = ""] = names(1);
      const shutdown = cascade(
        layer(weekdays(), who),
        replace(WEDNESDAY, cascade<string>()),
      );

      // When the week is resolved.
      // Then the Wednesday is blank. The claim stands with nothing in it, which
      // makes an empty replacement a way of saying "not this day, whatever the
      // layers below think".
      assertIdentical(
        read(shutdown),
        `[2026-03-09T00:00:00,2026-03-11T00:00:00)=${who} ` +
          `[2026-03-12T00:00:00,2026-03-14T00:00:00)=${who}`,
      );
    });

    it("clips a replacement that reaches outside the scope it replaces", () => {
      // Given an inner cascade covering every weekday, inside a layer claiming
      // one day.
      const [weekday = "", midweek = ""] = names(2);
      const everyDay = cascade(layer(weekdays(), midweek));
      const rota = cascade(
        layer(weekdays(), weekday),
        replace(WEDNESDAY, everyDay),
      );

      // When the week is resolved.
      // Then the replacement reaches the Wednesday only. A layer cannot assign
      // outside its own scope, however wide the rule inside it is.
      assertIdentical(
        read(rota),
        `[2026-03-09T00:00:00,2026-03-11T00:00:00)=${weekday} ` +
          `[2026-03-11T00:00:00,2026-03-12T00:00:00)=${midweek} ` +
          `[2026-03-12T00:00:00,2026-03-14T00:00:00)=${weekday}`,
      );
    });

    it("nests, because a replacement is an ordinary cascade", () => {
      // Given a replacement holding its own replacement: office hours with an
      // hour of lunch inside them, standing in for a whole week.
      const lunch = cascade(layer({ type: "always" }, "lunch"));
      const inner = cascade(
        layer(timeOfDay("09:00", "17:00"), "open"),
        replace(timeOfDay("12:00", "13:00"), lunch),
      );
      const rota = cascade(layer(WEDNESDAY, "shut"), replace(weekdays(), inner));
      const wednesday = inWindow("2026-03-11T00:00", "2026-03-12T00:00");

      // When the Wednesday is resolved.
      // Then both levels apply, and the lunch hour shows through the day.
      assertIdentical(
        read(rota, wednesday),
        "[2026-03-11T09:00:00,2026-03-11T12:00:00)=open " +
          "[2026-03-11T12:00:00,2026-03-11T13:00:00)=lunch " +
          "[2026-03-11T13:00:00,2026-03-11T17:00:00)=open",
      );
    });
  });

  describe("laziness", () => {
    it("answers from an endless context without exhausting it", () => {
      // Given a rota over a context with no end, which recurs forever.
      const [weekday = "", midweek = ""] = names(2);
      const rota = cascade(
        layer(weekdays(), weekday),
        layer(daysOfWeek("wednesday"), midweek),
      );
      const assigned = resolve(rota, inWindow("2026-03-09T00:00"));

      // When three stretches are taken.
      // Then they arrive. Taking is what stops the pull.
      assertIdentical(
        renderValued(take(assigned, 3)),
        `[2026-03-09T00:00:00,2026-03-11T00:00:00)=${weekday} ` +
          `[2026-03-11T00:00:00,2026-03-12T00:00:00)=${midweek} ` +
          `[2026-03-12T00:00:00,2026-03-14T00:00:00)=${weekday}`,
      );
    });

    it("hands an endless region to a replacement without bounding it", () => {
      // Given a layer claiming all of time, so the region it wins has no end
      // and the inner cascade has to be resolved against a context with none.
      const rota = cascade(replace(always(), timeOfDay("09:00", "17:00")));
      const assigned = resolve(rota, inWindow("2026-03-09T00:00"));

      // When two days are taken.
      // Then the inner hours keep coming.
      assertIdentical(
        renderValued(take(assigned, 2)),
        "[2026-03-09T09:00:00,2026-03-09T17:00:00)=true " +
          "[2026-03-10T09:00:00,2026-03-10T17:00:00)=true",
      );
    });

    it("reaches the unbounded future when a layer does", () => {
      // Given a layer covering all time and a context with no end.
      const forever = cascade(layer({ type: "always" }, "on"));
      const assigned = resolve(forever, { from: when("2026-03-09T00:00") });

      // When the first stretch is taken.
      // Then its end is unbounded, which the render shows as a star.
      assertIdentical(
        renderValued(take(assigned, 1)),
        "[2026-03-09T00:00:00,*)=on",
      );
    });
  });

  describe("whenever", () => {
    it("lifts a rule into a cascade that is true while it holds", () => {
      // Given a rule and nothing else.
      // When it is lifted and resolved.
      // Then it assigns true across itself, and nothing elsewhere. This is the
      // bridge from when to what.
      assertIdentical(
        read(whenever(WEDNESDAY)),
        "[2026-03-11T00:00:00,2026-03-12T00:00:00)=true",
      );
    });
  });
});
