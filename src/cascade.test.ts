import { faker } from "@faker-js/faker";
import {
  assertArrayEmpty,
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { dates, timeOfDay, weekdays } from "./build.js";
import {
  type Cascade,
  cascade,
  isCascade,
  layer,
  merged,
  replace,
  whenever,
} from "./cascade.js";
import { parseRule } from "./parse.js";

describe("cascades as data", () => {
  const WEDNESDAY = dates("2026-03-11");

  /** Two people who are certainly not the same person. */
  const twoNames = (): [string, string] => {
    const [first = "", second = ""] = faker.helpers.uniqueArray(
      () => faker.person.firstName(),
      2,
    );
    return [first, second];
  };

  describe("a built cascade", () => {
    it("refuses values JSON cannot preserve", () => {
      // Given values that JSON drops, rejects, or changes.
      const cyclic: Record<string, unknown> = {};
      cyclic["self"] = cyclic;
      class Assignment {
        public readonly person = "alice";
      }
      const symbolKeyed = { [Symbol("person")]: "alice" };
      const nonEnumerable = {};
      Object.defineProperty(nonEnumerable, "person", {
        value: "alice",
        enumerable: false,
      });

      // When each is assigned to a layer.
      // Then the authoring boundary refuses it.
      assertThrowsError(() => layer(weekdays(), undefined as never));
      assertThrowsError(() => layer(weekdays(), 1n as never));
      assertThrowsError(() => layer(weekdays(), Number.NaN as never));
      assertThrowsError(() => layer(weekdays(), Number.POSITIVE_INFINITY));
      assertThrowsError(() => layer(weekdays(), new Assignment() as never));
      assertThrowsError(() => layer(weekdays(), cyclic as never));
      assertThrowsError(() => layer(weekdays(), symbolKeyed as never));
      assertThrowsError(() => layer(weekdays(), nonEnumerable as never));
    });

    it("stores explanation context and refuses unusable text", () => {
      // Given a labelled assignment and options that contain no useful text.
      const annotated = layer(weekdays(), "alice", {
        label: "Primary support",
        comment: "Alice handles weekday incidents.",
      });

      // When the valid layer is read and the invalid options are built.
      // Then the context is data, while empty or unknown fields are refused.
      assertIdentical(annotated.label, "Primary support");
      assertIdentical(annotated.comment, "Alice handles weekday incidents.");
      assertThrowsError(() => layer(weekdays(), "alice", { label: " " }));
      assertThrowsError(() =>
        layer(weekdays(), "alice", { because: "weekday" } as never),
      );
    });

    it("checks raw layer values throughout public constructors", () => {
      // Given invalid values inside raw layers and a nested replacement.
      const invalid = { scope: weekdays(), value: undefined } as never;
      const nested = {
        type: "cascade",
        layers: [{ scope: weekdays(), value: 1n }],
      } as never as Cascade<never>;
      const invalidLabel = {
        scope: weekdays(),
        value: "alice",
        label: 42,
      } as never;

      // When each public cascade constructor receives one.
      // Then it refuses the value at the authoring boundary.
      assertThrowsError(() => cascade(invalid));
      assertThrowsError(() => merged("override", invalid));
      assertThrowsError(() => replace(WEDNESDAY, nested));
      assertThrowsError(() => cascade({ scope: WEDNESDAY, replace: nested }));
      assertThrowsError(() => cascade(invalidLabel));
    });

    it("is the document it stands for, with the builders' methods left out", () => {
      // Given a rota built through the builders, whose methods are functions
      // hanging off ordinary objects.
      const [weekdayCover, wednesdayCover] = twoNames();
      const rota = cascade(
        layer(weekdays(), weekdayCover),
        layer(WEDNESDAY, wednesdayCover),
      );

      // When it is serialised.
      const serialised = JSON.stringify(rota);

      // Then out comes the document a hand-written one would be, with the
      // methods gone.
      const document = {
        type: "cascade",
        layers: [
          {
            scope: {
              type: "daysOfWeek",
              days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            },
            value: weekdayCover,
          },
          {
            scope: { type: "dates", dates: ["2026-03-11"] },
            value: wednesdayCover,
          },
        ],
      };
      assertIdentical(serialised, JSON.stringify(document));
    });

    it("holds no layers when given none", () => {
      // Given nothing to layer, as a list filtered down to empty would give.
      // When a cascade is built from it.
      // Then it holds no layers, which is the identity for this shape.
      assertArrayEmpty(cascade<string>().layers);
    });
  });

  describe("replace", () => {
    it("stores a bare rule as the cascade it stands for", () => {
      // Given an early closing written with the rule form of the sugar.
      // When the layer is built.
      const early = replace(WEDNESDAY, timeOfDay("09:00", "15:00"));

      // Then what it holds is the lifted cascade. The sugar is resolved as the
      // layer is written, and a stored document carries only the one form.
      const document = {
        scope: { type: "dates", dates: ["2026-03-11"] },
        replace: {
          type: "cascade",
          layers: [
            {
              scope: { type: "timeOfDay", from: "09:00", to: "15:00" },
              value: true,
            },
          ],
        },
      };
      assertIdentical(JSON.stringify(early), JSON.stringify(document));
    });

    it("attaches context to a replacement", () => {
      // Given a changed-hours rule with a business label.
      // When its replacement layer is built.
      const early = replace(WEDNESDAY, timeOfDay("09:00", "15:00"), {
        label: "Team meeting",
      });

      // Then the label is stored beside the scope it describes.
      assertIdentical(early.label, "Team meeting");
    });

    it("keeps a cascade replacement as it was given", () => {
      // Given a replacement that is already a cascade.
      const inner = cascade(layer(timeOfDay("09:00", "15:00"), "short"));

      // When the layer is built.
      const layered = replace(WEDNESDAY, inner);

      // Then the cascade is stored untouched, with no second lifting.
      assertIdentical(layered.replace, inner);
    });
  });

  describe("the boundary with rules", () => {
    it("refuses a cascade handed to the rule parser", () => {
      // Given a cascade, which is tagged data of the same shape family as a
      // rule and could plausibly be handed to the wrong reader.
      const schedule = whenever(weekdays());

      // When the rule parser is asked to read it.
      const error = assertThrowsError(() => parseRule(schedule));

      // Then it says which type it found, and stops.
      assertInstanceOf(error, TypeError);
      assertStringIncludes(error.message, '"cascade" is not a rule type');
    });

    it("tells a cascade from a rule", () => {
      // Given one of each.
      const schedule = whenever(weekdays());
      const rule = weekdays();

      // When each is tested.
      // Then only the cascade answers to it.
      assertTrue(isCascade(schedule));
      assertFalse(isCascade(rule));
    });
  });
});
