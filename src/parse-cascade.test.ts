import {
  assertArrayEquals,
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
} from "@kensio/smartass";
import { faker } from "@faker-js/faker";
import { describe, it } from "vitest";

import { cascade, layer, merged, replace, whenever } from "./cascade.js";
import { dates, daysOfWeek, weekdays, weekends } from "./build.js";
import { parseCascade } from "./parse-cascade.js";
import { asBoolean, asString, fail, shapeOf } from "./parse-shape.js";
import { resolve } from "./resolve.js";
import { take } from "./stream.js";

describe("parsing a cascade from JSON", () => {
  /** A value parser for the cascades of numbers below. */
  const asNumber = (value: unknown, path: string): number =>
    typeof value === "number" ? value : fail(path, "expected a number");

  /** The message from parsing something that should not parse. */
  const complaintAbout = (value: unknown): string => {
    const error = assertThrowsError(() => parseCascade(value, asString));
    assertInstanceOf(error, TypeError);
    return error.message;
  };

  /**
   * What a document looks like once it has been through `JSON.stringify`,
   * which is the form a database column or an API body actually holds. A
   * structured clone would keep things JSON does not, and the things JSON
   * drops are the ones worth testing against.
   */
  const stored = (value: unknown): unknown => {
    const written = JSON.stringify(value);
    return JSON.parse(written) as unknown;
  };

  describe("a valid cascade", () => {
    it("takes one a builder wrote", () => {
      // Given a rota stored as whatever `JSON.stringify` made of it, which is
      // what a database column actually holds.
      const alice = faker.person.firstName();
      const bob = faker.person.firstName();
      const onCall = cascade(layer(weekdays(), alice), layer(weekends(), bob));
      const document = stored(onCall);

      // When it is read back and serialised again.
      // Then nothing has moved.
      assertIdentical(
        JSON.stringify(parseCascade(document, asString)),
        JSON.stringify(document),
      );
    });

    it("keeps labels and comments on stored layers", () => {
      // Given a stored assignment with caller-written explanation context.
      const original = cascade(
        layer(weekdays(), "alice", {
          label: "Primary support",
          comment: "Alice handles weekday incidents.",
        }),
      );
      const document = stored(original);

      // When the cascade is parsed.
      const parsed = parseCascade(document, asString);

      // Then the context survives as part of the layer document.
      assertIdentical(JSON.stringify(parsed), JSON.stringify(document));
    });

    it("takes a replacing layer, and the cascade inside it", () => {
      // Given a schedule that closes early on one day, which is the shape a
      // plain value cannot express.
      const shorterDay = whenever(weekdays());
      const openingHours = cascade(
        layer(weekdays(), true),
        replace(dates("2026-03-11"), shorterDay),
      );
      const document = stored(openingHours);

      // When it is read back and serialised again.
      // Then the nesting survives, layers and all.
      assertIdentical(
        JSON.stringify(parseCascade(document, asBoolean)),
        JSON.stringify(document),
      );
    });

    it("resolves to the same answers the original did", () => {
      // Given a rota, and the same rota after a round trip through JSON. A
      // document that parses but means something else is the failure worth
      // catching, and comparing the two documents cannot see it.
      const alice = faker.person.firstName();
      const bob = faker.person.firstName();
      const original = cascade(
        layer(daysOfWeek("monday", "tuesday"), alice),
        layer(dates("2026-03-10"), bob),
      );
      const parsed = parseCascade(stored(original), asString);

      // When both are resolved over the same week.
      const week = {
        from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
        to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
      };
      const shifts = (of: typeof original): string[] =>
        [...resolve(of, week)].map(
          (shift) => `${shift.start?.toString() ?? ""} ${shift.value}`,
        );

      // Then they assign the same people over the same stretches. The Tuesday
      // override is Bob's, and it still outranks Alice's weekdays.
      assertArrayEquals(shifts(parsed), shifts(original));
    });

    it("takes a cascade with no layers", () => {
      // Given the empty cascade, as filtering every layer out of one would
      // give.
      // When it is parsed.
      // Then it is accepted. It assigns nothing, and refusing it would make
      // building a cascade from a list a special case.
      assertIdentical(
        JSON.stringify(parseCascade({ type: "cascade", layers: [] }, asString)),
        '{"type":"cascade","layers":[]}',
      );
    });

    it("reads a value at whatever type the caller keeps it in", () => {
      // Given a cascade of headcounts, which Quando has never heard of, and a
      // parser for them written by the caller.
      const asHeadcount = (value: unknown, path: string): number =>
        typeof value === "number" && Number.isInteger(value)
          ? value
          : fail(
              path,
              `expected a whole number of staff, found ${shapeOf(value)}`,
            );
      const staff = faker.number.int({ min: 1, max: 20 });

      // When a document carrying one is parsed with it, and resolved.
      const roster = cascade(layer(weekdays(), staff));
      const parsed = parseCascade(stored(roster), asHeadcount);
      const week = {
        from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
      };
      const [monday] = take(resolve(parsed, week), 1);

      // Then the cascade assigns the headcount as a number, rather than as
      // whatever unknown JSON it was stored as.
      assertIdentical(monday?.value, staff);
    });
  });

  describe("the merge strategy", () => {
    it("checks strategy values while parsing", () => {
      // Given a stored sum whose value is a name.
      const document = {
        type: "cascade",
        merge: "sum",
        layers: [{ scope: { type: "always" }, value: "alice" }],
      };

      // When it is parsed.
      const error = assertThrowsError(() => parseCascade(document, asString));

      // Then the mismatch is reported before resolution.
      assertIdentical(
        error.message,
        "cascade.layers[0].value: sum needs numbers.",
      );
    });

    it("round trips a cascade that names one", () => {
      // Given a roster of headcounts whose overlaps add.
      const staff = merged("sum", layer(weekdays(), 3), layer(weekends(), 1));
      const document = stored(staff);

      // When it is read back and serialised again.
      // Then the strategy survives with everything else. A document that lost
      // it would parse cleanly and mean something different.
      assertIdentical(
        JSON.stringify(parseCascade(document, asNumber)),
        JSON.stringify(document),
      );
    });

    it("checks a replacement with its own merge strategy", () => {
      // Given a numeric sum containing a replacement that concatenates lists.
      const document = {
        type: "cascade",
        merge: "sum",
        layers: [
          { scope: { type: "always" }, value: 1 },
          {
            scope: { type: "always" },
            replace: {
              type: "cascade",
              merge: "concat",
              layers: [{ scope: { type: "always" }, value: ["alice"] }],
            },
          },
        ],
      };
      const asNumberOrNames = (
        value: unknown,
        path: string,
      ): number | readonly string[] => {
        if (typeof value === "number") {
          return value;
        }
        if (
          Array.isArray(value) &&
          value.every((item) => typeof item === "string")
        ) {
          return value;
        }
        return fail(path, "expected a number or a list of names");
      };

      // When the outer cascade is parsed.
      // Then the replacement values are checked against concat.
      assertIdentical(
        JSON.stringify(parseCascade(document, asNumberOrNames)),
        JSON.stringify(document),
      );
    });

    it("leaves an absent strategy absent rather than undefined", () => {
      // Given a cascade that says nothing about merging.
      // When it is parsed and serialised.
      // Then the field is still missing. A present `undefined` would make two
      // equivalent cascades compare as different documents.
      const plain = { type: "cascade", layers: [] };
      assertIdentical(
        JSON.stringify(parseCascade(plain, asString)),
        '{"type":"cascade","layers":[]}',
      );
    });

    it("refuses a strategy it has not heard of", () => {
      // Given a document naming a merge Quando does not implement.
      // When it is parsed.
      // Then it is refused, and the message lists the ones that exist.
      assertIdentical(
        complaintAbout({ type: "cascade", merge: "average", layers: [] }),
        'cascade.merge: "average" is not a merge strategy. Expected one of ' +
          "override, sum, max, min, concat",
      );
      assertIdentical(
        complaintAbout({ type: "cascade", merge: 7, layers: [] }),
        "cascade.merge: expected a merge strategy, found number",
      );
    });
  });

  describe("refusing an invalid cascade", () => {
    it("says what it found instead of a cascade", () => {
      // Given things a column might hold that are not cascade objects.
      // When each is parsed.
      // Then the message names the shape that arrived.
      assertIdentical(
        complaintAbout(null),
        "cascade: expected a cascade object, found null",
      );
      assertIdentical(
        complaintAbout([{ type: "cascade", layers: [] }]),
        "cascade: expected a cascade object, found an array",
      );
    });

    it("refuses a document that is a rule rather than a cascade", () => {
      // Given a rule where a cascade was expected, which is the likeliest
      // mix-up of the two: both are stored the same way and both have a type.
      // When it is parsed.
      // Then the message says which type was found.
      assertIdentical(
        complaintAbout({ type: "daysOfWeek", days: ["monday"] }),
        'cascade.type: expected "cascade", found "daysOfWeek"',
      );
      assertIdentical(
        complaintAbout({ layers: [] }),
        'cascade.type: expected "cascade", found undefined',
      );
    });

    it("refuses a field a cascade does not have", () => {
      // Given a cascade carrying a scope, which belongs on a layer.
      // When it is parsed.
      // Then it is refused rather than quietly dropped.
      assertIdentical(
        complaintAbout({
          type: "cascade",
          layers: [],
          scope: { type: "always" },
        }),
        "cascade.scope: is not a field of a cascade. Expected merge, layers",
      );
    });

    it("refuses layers that are not a list of them", () => {
      // Given a cascade whose layers are an object, as a document written by
      // hand might have.
      // When it is parsed.
      // Then the message says what a layers field holds.
      assertIdentical(
        complaintAbout({ type: "cascade", layers: { first: {} } }),
        "cascade.layers: expected an array of layers, found object",
      );
    });

    it("refuses a layer holding both a value and a replace", () => {
      // Given a layer saying two different things about its scope at once.
      // When it is parsed.
      // Then it is refused, because there is no answer to which one wins.
      assertIdentical(
        complaintAbout({
          type: "cascade",
          layers: [
            {
              scope: { type: "always" },
              value: "alice",
              replace: { type: "cascade", layers: [] },
            },
          ],
        }),
        "cascade.layers[0]: has both a value and a replace, and a layer holds " +
          "one or the other. A value applies across the whole scope, and a " +
          "replace hands the scope to another cascade",
      );
    });

    it("refuses a layer holding neither, and says how one gets that way", () => {
      // Given a layer built with `undefined` as its value. `JSON.stringify`
      // drops the field rather than writing it, so what is stored has a scope
      // and nothing else.
      const document = {
        type: "cascade",
        layers: [{ scope: weekdays() }],
      };

      // When it is parsed.
      // Then it is refused, and the message names the cause rather than
      // leaving a caller to work out where their value went.
      assertIdentical(
        complaintAbout(document),
        "cascade.layers[0]: has neither a value nor a replace, so nothing " +
          "holds inside its scope. A layer built with `undefined` as its " +
          "value arrives this way, because `JSON.stringify` drops the field " +
          "rather than writing it",
      );
    });

    it("refuses a type on a layer", () => {
      // Given a layer carrying the type its cascade carries, which is the
      // mistake someone writing a document by hand makes.
      // When it is parsed.
      // Then it is refused. Waving it past would drop it silently, and the
      // document would no longer be the one that was stored.
      assertIdentical(
        complaintAbout({
          type: "cascade",
          layers: [{ type: "layer", scope: { type: "always" }, value: "a" }],
        }),
        "cascade.layers[0].type: is not a field of a layer. The cascade " +
          "around it carries the type",
      );
    });

    it("refuses a field a layer does not have", () => {
      // Given a layer with a misspelled `value`.
      // When it is parsed.
      // Then it is refused rather than read as a layer with no value at all.
      assertIdentical(
        complaintAbout({
          type: "cascade",
          layers: [{ scope: { type: "always" }, valeu: "alice" }],
        }),
        "cascade.layers[0].valeu: is not a field of a layer. Expected scope, " +
          "value, replace, label, comment",
      );
    });

    it("refuses invalid explanation context", () => {
      // Given layers with an empty label and a non-text comment.
      const emptyLabel = {
        type: "cascade",
        layers: [{ scope: { type: "always" }, value: "alice", label: "   " }],
      };
      const numberedComment = {
        type: "cascade",
        layers: [{ scope: { type: "always" }, value: "alice", comment: 42 }],
      };

      // When each stored cascade is parsed.
      // Then the invalid field is reported at its document path.
      assertIdentical(
        complaintAbout(emptyLabel),
        "cascade.layers[0].label: expected a non-empty string.",
      );
      assertIdentical(
        complaintAbout(numberedComment),
        "cascade.layers[0].comment: expected a non-empty string.",
      );
    });

    it("checks the scope as a rule", () => {
      // Given a layer whose scope is not a rule Quando knows.
      // When it is parsed.
      // Then the rule parser's own complaint comes back, at the layer's path.
      assertIdentical(
        complaintAbout({
          type: "cascade",
          layers: [{ scope: { type: "weekdays" }, value: "alice" }],
        }),
        'cascade.layers[0].scope.type: "weekdays" is not a rule type. ' +
          "Expected one of always, never, daysOfWeek, timeOfDay, dates, inZone, " +
          "all, any, not",
      );
    });

    it("reports a bad value against its own path", () => {
      // Given a rota with a number where a name should be, three layers into
      // a replacement.
      const document = {
        type: "cascade",
        layers: [
          {
            scope: { type: "always" },
            replace: {
              type: "cascade",
              layers: [{ scope: { type: "always" }, value: 7 }],
            },
          },
        ],
      };

      // When it is parsed.
      // Then the path leads to the value rather than to the top of the
      // document.
      assertIdentical(
        complaintAbout(document),
        "cascade.layers[0].replace.layers[0].value: expected a string, found " +
          "number",
      );
    });

    it("takes a path to report against", () => {
      // Given a cascade stored inside something larger, where "cascade" is
      // not what the reader of the error is looking at.
      // When it is parsed under the name that thing calls it.
      // Then every message is rooted there.
      const error = assertThrowsError(() =>
        parseCascade({ type: "cascade" }, asString, "settings.openingHours"),
      );
      assertIdentical(
        error.message,
        "settings.openingHours.layers: expected an array of layers, found " +
          "undefined",
      );
    });
  });
});
