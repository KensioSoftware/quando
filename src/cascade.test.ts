import {
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { dates, timeOfDay, weekdays } from "./build.js";
import { cascade, isCascade, layer, replace, whenever } from "./cascade.js";
import { parseRule } from "./parse.js";

const WEDNESDAY = dates("2026-03-11");

describe("a built cascade", () => {
  it("is the document it stands for, with the builders' methods left out", () => {
    const rota = cascade(layer(weekdays(), "alice"), layer(WEDNESDAY, "bob"));

    const document = {
      type: "cascade",
      layers: [
        {
          scope: {
            type: "daysOfWeek",
            days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          },
          value: "alice",
        },
        {
          scope: { type: "dates", dates: ["2026-03-11"] },
          value: "bob",
        },
      ],
    };

    assertIdentical(JSON.stringify(rota), JSON.stringify(document));
  });

  it("holds no layers when given none", () => {
    // The identity: a cascade of nothing assigns nothing, which is what makes
    // building one from a list that filtered to empty behave.
    assertArrayLength(cascade<string>().layers, 0);
  });
});

describe("replace", () => {
  it("stores a bare rule as the cascade it stands for", () => {
    // The sugar is resolved when the layer is written, so a stored document
    // never needs a reader to know which of the two forms was used.
    const early = replace(WEDNESDAY, timeOfDay("09:00", "15:00"));

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

  it("keeps a cascade replacement as it was given", () => {
    const inner = cascade(layer(timeOfDay("09:00", "15:00"), "short"));
    const layered = replace(WEDNESDAY, inner);

    assertIdentical(layered.replace, inner);
  });
});

describe("the boundary with rules", () => {
  it("is refused by parseRule, which reads rules and not cascades", () => {
    // A cascade is tagged data too, so it is worth knowing that handing one to
    // the rule parser says so rather than half-succeeding.
    const schedule = whenever(weekdays());

    const error = assertThrowsError(() => parseRule(schedule));

    assertInstanceOf(error, TypeError);
    assertStringIncludes(error.message, '"cascade" is not a rule type');
  });
});

describe("isCascade", () => {
  it("tells a cascade from a rule", () => {
    const schedule = whenever(weekdays());

    assertTrue(isCascade(schedule));
    assertFalse(isCascade(weekdays()));
  });
});
