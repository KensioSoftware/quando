import { inWindow, render, renderValued, when } from "#test/intervals.js";
import {
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { assigned, nextValue, valueAt } from "./assigned.js";
import { always, dates, weekdays } from "./build.js";
import type { Cascade } from "./cascade.js";
import { BeyondHorizonError } from "./horizon-guard.js";
import { knownThrough } from "./horizon.js";
import { activeAt } from "./query.js";
import { resolve, uncertainValues } from "./resolve.js";

describe("a cascade whose layers run out of data", () => {
  /** Christmas, from a table loaded only as far as 2026. */
  const holidays = (): ReturnType<typeof knownThrough> =>
    knownThrough("2026-12-31", dates("2026-12-25"));

  /** Monday 2029-04-02 to the Monday after, past the horizon. */
  const BEYOND = inWindow("2029-04-02T00:00", "2029-04-09T00:00");

  /** Monday 2026-03-09 to the Monday after, with the horizon ahead. */
  const WITHIN = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

  describe("costing nothing to a cascade without one", () => {
    it("resolves the way it always did", () => {
      // Given a cascade with no horizon anywhere in it.
      const roster: Cascade<string> = {
        type: "cascade",
        layers: [
          { scope: weekdays(), value: "open" },
          { scope: dates("2026-12-25"), value: "closed" },
        ],
      };

      // When it is resolved over a week past every date it names.
      // Then the weekdays come back open, and nothing is in doubt.
      assertIdentical(
        renderValued(resolve(roster, BEYOND)),
        "[2029-04-02T00:00:00,2029-04-07T00:00:00)=open",
      );
      assertIdentical(render(uncertainValues(roster, BEYOND)), "");
    });
  });

  describe("a layer that might claim a moment", () => {
    /** Open on weekdays, with a holiday layer laid over the top. */
    const schedule: Cascade<string> = {
      type: "cascade",
      layers: [
        { scope: weekdays(), value: "open" },
        { label: "holidays", scope: holidays(), value: "closed" },
      ],
    };

    it("leaves nothing settled where it could claim anything", () => {
      // Given the holiday layer on top, past the horizon it was loaded to.
      // When the week is resolved.
      // Then nothing comes back settled, because the layer above might assign
      // "closed" to any moment of it, weekend included.
      assertIdentical(renderValued(resolve(schedule, BEYOND)), "");
      assertIdentical(
        render(uncertainValues(schedule, BEYOND)),
        "[2029-04-02T00:00:00,2029-04-09T00:00:00)",
      );
    });

    it("settles everything inside the horizon", () => {
      // Given the same cascade over a week the table was loaded for.
      // When it is resolved.
      // Then the working week is open and nothing is in doubt.
      assertIdentical(
        renderValued(resolve(schedule, WITHIN)),
        "[2026-03-09T00:00:00,2026-03-14T00:00:00)=open",
      );
      assertIdentical(render(uncertainValues(schedule, WITHIN)), "");
    });

    it("refuses to say what holds at a moment it cannot settle", () => {
      // Given a Tuesday past the horizon.
      const asking = (): string | undefined =>
        valueAt(schedule, when("2029-04-03T10:00"));

      // Then it refuses rather than reporting the moment as unclaimed.
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });
  });

  describe("a layer that cannot change the answer", () => {
    /** The holiday layer underneath one that claims everything. */
    const covered: Cascade<string> = {
      type: "cascade",
      layers: [
        { label: "holidays", scope: holidays(), value: "closed" },
        { scope: always(), value: "open" },
      ],
    };

    it("settles the answer anyway", () => {
      // Given a fogged layer under one that certainly claims the whole week.
      // When it is resolved past the horizon.
      // Then the week is open throughout, because the later layer displaces
      // whatever the one under it might have said.
      assertIdentical(
        renderValued(resolve(covered, BEYOND)),
        "[2029-04-02T00:00:00,2029-04-09T00:00:00)=open",
      );
      assertIdentical(render(uncertainValues(covered, BEYOND)), "");
    });

    it("leaves only the part no settled layer reaches", () => {
      // Given the same fogged layer, under one that claims weekdays only.
      const partly: Cascade<string> = {
        type: "cascade",
        layers: [
          { label: "holidays", scope: holidays(), value: "closed" },
          { scope: weekdays(), value: "open" },
        ],
      };

      // When it is resolved past the horizon.
      // Then the weekdays are open, and only the weekend is in doubt, because
      // that is the only part the fogged layer could still have claimed.
      assertIdentical(
        renderValued(resolve(partly, BEYOND)),
        "[2029-04-02T00:00:00,2029-04-07T00:00:00)=open",
      );
      assertIdentical(
        render(uncertainValues(partly, BEYOND)),
        "[2029-04-07T00:00:00,2029-04-09T00:00:00)",
      );
    });
  });

  describe("a merge that adds contributions up", () => {
    it("cannot settle a total with a contribution it is unsure of", () => {
      // Given two layers of one apiece, one of which runs out of data.
      const headcount: Cascade<number> = {
        type: "cascade",
        merge: "sum",
        layers: [
          { scope: always(), value: 1 },
          { scope: knownThrough("2026-12-31", always()), value: 1 },
        ],
      };

      // When the total is resolved past the horizon.
      // Then none of it is settled, because every layer counts towards a sum
      // and one of them cannot be vouched for.
      assertIdentical(renderValued(resolve(headcount, BEYOND)), "");
      assertIdentical(
        render(uncertainValues(headcount, BEYOND)),
        "[2029-04-02T00:00:00,2029-04-09T00:00:00)",
      );
    });
  });

  describe("the questions a cascade answers", () => {
    const schedule: Cascade<string> = {
      type: "cascade",
      layers: [
        { scope: weekdays(), value: "open" },
        { label: "holidays", scope: holidays(), value: "closed" },
      ],
    };

    it("answers where the fog is behind it", () => {
      // Given a moment inside the horizon.
      // When it is asked what holds.
      // Then it answers, because nothing about it is in doubt.
      assertIdentical(valueAt(schedule, when("2026-03-09T10:00")), "open");
    });

    it("says nothing holds where nothing does", () => {
      // Given a Saturday inside the horizon, which no layer claims.
      // When it is asked what holds.
      // Then nothing, which is different from not knowing.
      assertUndefined(valueAt(schedule, when("2026-03-14T10:00")));
    });

    it("refuses a search that would run through the fog", () => {
      // Given a window opening past the horizon.
      const asking = (): unknown => nextValue(schedule, BEYOND);

      // Then it refuses, because an unsettled stretch might have been the
      // answer.
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });

    it("refuses a rule question narrowed to one value", () => {
      // Given the cascade narrowed to the times it says "open".
      const open = assigned(schedule, "open");

      // When a Tuesday past the horizon is asked about.
      const asking = (): boolean => activeAt(open, when("2029-04-03T10:00"));

      // Then it refuses, the same way the cascade itself does.
      assertInstanceOf(assertThrowsError(asking), BeyondHorizonError);
    });
  });

  describe("a layer that replaces what is under it", () => {
    it("leaves the replaced region unsettled where its scope is", () => {
      // Given a replacement whose own scope runs out of data.
      const nested: Cascade<string> = {
        type: "cascade",
        layers: [
          { scope: always(), value: "open" },
          {
            label: "closure",
            scope: holidays(),
            replace: {
              type: "cascade",
              layers: [{ scope: always(), value: "shut" }],
            },
          },
        ],
      };

      // When it is resolved past the horizon.
      // Then nothing is settled, because the replacement might claim any of
      // it and the base hours would then be out of the way.
      assertIdentical(renderValued(resolve(nested, BEYOND)), "");
      assertIdentical(
        render(uncertainValues(nested, BEYOND)),
        "[2029-04-02T00:00:00,2029-04-09T00:00:00)",
      );
    });
  });
});
