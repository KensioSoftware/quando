import { inWindow, renderValued, when } from "#test/intervals.js";
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

/** Monday 2026-03-09 to Monday 2026-03-16, a whole week. */
const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

const WEDNESDAY = dates("2026-03-11");

const read = <V>(assigned: Cascade<V>, context: Context = WEEK): string =>
  renderValued(resolve(assigned, context));

describe("a cascade of one layer", () => {
  it("assigns its value across its scope", () => {
    const rota = cascade(layer(WEDNESDAY, "alice"));

    assertIdentical(
      read(rota),
      "[2026-03-11T00:00:00,2026-03-12T00:00:00)=alice",
    );
  });

  it("assigns nothing where no layer claims", () => {
    const rota = cascade(layer({ type: "never" }, "alice"));

    assertIdentical(read(rota), "");
  });

  it("assigns nothing at all when there are no layers", () => {
    assertIdentical(read(cascade<string>()), "");
  });
});

describe("precedence", () => {
  it("gives a moment to the last layer that claims it", () => {
    const rota = cascade(layer(weekdays(), "alice"), layer(WEDNESDAY, "bob"));

    assertIdentical(
      read(rota),
      "[2026-03-09T00:00:00,2026-03-11T00:00:00)=alice " +
        "[2026-03-11T00:00:00,2026-03-12T00:00:00)=bob " +
        "[2026-03-12T00:00:00,2026-03-14T00:00:00)=alice",
    );
  });

  it("is decided by order, not by how specific a scope is", () => {
    // The same two layers the other way round: the broad one now wins
    // outright, because nothing above it claims anything.
    const rota = cascade(layer(WEDNESDAY, "bob"), layer(weekdays(), "alice"));

    assertIdentical(
      read(rota),
      "[2026-03-09T00:00:00,2026-03-14T00:00:00)=alice",
    );
  });

  it("lets a higher layer cut a hole rather than replace a whole run", () => {
    const lunch = all(WEDNESDAY, timeOfDay("12:00", "13:00"));
    const rota = cascade(layer(weekdays(), "alice"), layer(lunch, "bob"));

    assertIdentical(
      read(rota),
      "[2026-03-09T00:00:00,2026-03-11T12:00:00)=alice " +
        "[2026-03-11T12:00:00,2026-03-11T13:00:00)=bob " +
        "[2026-03-11T13:00:00,2026-03-14T00:00:00)=alice",
    );
  });

  it("takes the topmost of three overlapping claims", () => {
    const midweek = dates("2026-03-11", "2026-03-12");
    const rota = cascade(
      layer(weekdays(), "alice"),
      layer(WEDNESDAY, "bob"),
      layer(midweek, "carol"),
    );

    assertIdentical(
      read(rota),
      "[2026-03-09T00:00:00,2026-03-11T00:00:00)=alice " +
        "[2026-03-11T00:00:00,2026-03-13T00:00:00)=carol " +
        "[2026-03-13T00:00:00,2026-03-14T00:00:00)=alice",
    );
  });
});

describe("coalescing", () => {
  it("joins touching intervals that carry the same value", () => {
    // Two layers, one value: the seam between them is not a boundary in the
    // answer, and reporting it as one would break the coalesced contract.
    const early = daysOfWeek("monday", "tuesday");
    const rota = cascade(
      layer(early, "alice"),
      layer(daysOfWeek("wednesday"), "alice"),
    );

    assertIdentical(
      read(rota),
      "[2026-03-09T00:00:00,2026-03-12T00:00:00)=alice",
    );
  });

  it("keeps touching intervals apart when their values differ", () => {
    const rota = cascade(
      layer(daysOfWeek("monday"), "alice"),
      layer(daysOfWeek("tuesday"), "bob"),
    );

    assertIdentical(
      read(rota),
      "[2026-03-09T00:00:00,2026-03-10T00:00:00)=alice " +
        "[2026-03-10T00:00:00,2026-03-11T00:00:00)=bob",
    );
  });

  it("leaves a gap between intervals that do not touch", () => {
    const rota = cascade(
      layer(daysOfWeek("monday"), "alice"),
      layer(daysOfWeek("wednesday"), "alice"),
    );

    assertIdentical(
      read(rota),
      "[2026-03-09T00:00:00,2026-03-10T00:00:00)=alice " +
        "[2026-03-11T00:00:00,2026-03-12T00:00:00)=alice",
    );
  });

  it("merges the same object, and leaves equal-looking ones apart", () => {
    const monday = daysOfWeek("monday");
    const tuesday = daysOfWeek("tuesday");
    const alice = { name: "alice" };

    const shared = cascade(layer(monday, alice), layer(tuesday, alice));
    const alike = cascade(
      layer(monday, { name: "alice" }),
      layer(tuesday, { name: "alice" }),
    );

    assertArrayLength([...resolve(shared, WEEK)], 1);
    assertArrayLength([...resolve(alike, WEEK)], 2);
  });
});

describe("a replacing layer", () => {
  const baseHours = all(weekdays(), timeOfDay("09:00", "17:00"));
  const openingHours = cascade(
    layer(baseHours, true),
    replace(WEDNESDAY, timeOfDay("09:00", "15:00")),
  );

  it("replaces the hours inside its scope rather than punching a hole", () => {
    assertIdentical(
      read(openingHours),
      "[2026-03-09T09:00:00,2026-03-09T17:00:00)=true " +
        "[2026-03-10T09:00:00,2026-03-10T17:00:00)=true " +
        "[2026-03-11T09:00:00,2026-03-11T15:00:00)=true " +
        "[2026-03-12T09:00:00,2026-03-12T17:00:00)=true " +
        "[2026-03-13T09:00:00,2026-03-13T17:00:00)=true",
    );
  });

  it("does not let the layers below show through what it left unassigned", () => {
    // The base hours run to 17:00 on the eleventh. The replacement stops at
    // 15:00, and the two hours between are unassigned rather than open, which
    // is the whole point of claiming the scope.
    const afterClosing = inWindow("2026-03-11T15:00", "2026-03-12T00:00");

    assertArrayLength([...resolve(openingHours, afterClosing)], 0);
  });

  it("clips a replacement that reaches outside the scope it replaces", () => {
    // The inner cascade covers every weekday; the layer claims one day.
    const everyDay = cascade(layer(weekdays(), "bob"));
    const rota = cascade(
      layer(weekdays(), "alice"),
      replace(WEDNESDAY, everyDay),
    );

    assertIdentical(
      read(rota),
      "[2026-03-09T00:00:00,2026-03-11T00:00:00)=alice " +
        "[2026-03-11T00:00:00,2026-03-12T00:00:00)=bob " +
        "[2026-03-12T00:00:00,2026-03-14T00:00:00)=alice",
    );
  });

  it("nests, because a replacement is an ordinary cascade", () => {
    const lunch = cascade(layer({ type: "always" }, "lunch"));
    const inner = cascade(
      layer(timeOfDay("09:00", "17:00"), "open"),
      replace(timeOfDay("12:00", "13:00"), lunch),
    );
    const rota = cascade(layer(WEDNESDAY, "shut"), replace(weekdays(), inner));
    const wednesday = inWindow("2026-03-11T00:00", "2026-03-12T00:00");

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
    const rota = cascade(
      layer(weekdays(), "alice"),
      layer(daysOfWeek("wednesday"), "bob"),
    );
    const endless = inWindow("2026-03-09T00:00");
    const assigned = resolve(rota, endless);

    assertIdentical(
      renderValued(take(assigned, 3)),
      "[2026-03-09T00:00:00,2026-03-11T00:00:00)=alice " +
        "[2026-03-11T00:00:00,2026-03-12T00:00:00)=bob " +
        "[2026-03-12T00:00:00,2026-03-14T00:00:00)=alice",
    );
  });

  it("hands an endless region to a replacement without bounding it", () => {
    // The layer claims all of time, so the region it wins has no end, and the
    // inner cascade has to be resolved against a context that has none either.
    const alwaysOpen = replace(always(), timeOfDay("09:00", "17:00"));
    const rota = cascade(alwaysOpen);
    const assigned = resolve(rota, inWindow("2026-03-09T00:00"));

    assertIdentical(
      renderValued(take(assigned, 2)),
      "[2026-03-09T09:00:00,2026-03-09T17:00:00)=true " +
        "[2026-03-10T09:00:00,2026-03-10T17:00:00)=true",
    );
  });

  it("reaches the unbounded future when a layer does", () => {
    const forever = cascade(layer({ type: "always" }, "on"));
    const assigned = resolve(forever, { from: when("2026-03-09T00:00") });
    const first = take(assigned, 1);

    assertIdentical(renderValued(first), "[2026-03-09T00:00:00,*)=on");
  });
});

describe("whenever", () => {
  it("lifts a rule into a cascade that is true while it holds", () => {
    assertIdentical(
      read(whenever(WEDNESDAY)),
      "[2026-03-11T00:00:00,2026-03-12T00:00:00)=true",
    );
  });
});
