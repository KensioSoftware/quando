import { when } from "#test/intervals.js";
import { assertArrayEmpty, assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { always, dates, never, weekdays, weekends } from "./build.js";
import { cascade, layer, merged, replace } from "./cascade.js";
import { validate } from "./semantic-validation.js";

describe("nested layer validation", () => {
  const week = () => ({
    from: when("2026-03-09T00:00"),
    to: when("2026-03-16T00:00"),
  });

  it("reports children outside their parent's scope", () => {
    // Given a weekday replacement containing a weekend assignment.
    const inner = cascade(layer(weekends(), 1));
    const source = cascade(replace(weekdays(), inner));

    // When the whole week is validated.
    const result = validate(source, week());

    // Then the child is inactive within its parent.
    assertArrayEquals(
      result.map((d) => `${d.code}:${"path" in d ? d.path : ""}`),
      ["inactive-layer:layers[0].replace.layers[0]"],
    );
  });

  it("reports shadowing at multiple replacement depths", () => {
    // Given two overlapping assignments inside two replacements.
    const inner = cascade(layer(always(), 1), layer(always(), 2));
    const middle = cascade(replace(always(), inner));
    const source = cascade(replace(always(), middle));

    // When the outer cascade is validated.
    const result = validate(source, week());

    // Then the path identifies the hidden grandchild.
    assertArrayEquals(
      result.map((d) => `${d.code}:${"path" in d ? d.path : ""}`),
      ["shadowed-layer:layers[0].replace.layers[0].replace.layers[0]"],
    );
  });

  it.each([never(), dates("2027-01-01")])(
    "stops at an inactive parent (%j)",
    (scope) => {
      // Given an inactive replacement whose children also contain errors.
      const inner = cascade(layer(never(), 1), layer(always(), 2));
      const source = cascade(replace(scope, inner));

      // When validation reaches the parent.
      const result = validate(source, week());

      // Then one parent diagnostic accounts for the entire subtree.
      assertArrayEquals(
        result.map((d) => `${d.code}:${"path" in d ? d.path : ""}`),
        ["inactive-layer:layers[0]"],
      );
    },
  );

  it("stops at a shadowed parent", () => {
    // Given a replacement hidden by a later assignment.
    const inner = cascade(layer(never(), 1));
    const source = cascade(replace(always(), inner), layer(always(), 2));

    // When the cascade is validated.
    const result = validate(source, week());

    // Then its child receives no redundant diagnostic.
    assertArrayEquals(
      result.map((d) => `${d.code}:${"path" in d ? d.path : ""}`),
      ["shadowed-layer:layers[0]"],
    );
  });

  it("excludes the hidden part of a parent's scope", () => {
    // Given a replacement whose weekend coverage is overridden outside it.
    const inner = cascade(layer(weekends(), 1), layer(weekdays(), 2));
    const source = cascade(replace(always(), inner), layer(weekends(), 3));

    // When the surviving weekday region is validated.
    const result = validate(source, week());

    // Then only the weekend child is inactive.
    assertArrayEquals(
      result.map((d) => `${d.code}:${"path" in d ? d.path : ""}`),
      ["inactive-layer:layers[0].replace.layers[0]"],
    );
  });

  it("checks all disconnected parts of the parent region together", () => {
    // Given children that each cover only one part of a disjoint parent.
    const monday = dates("2026-03-09");
    const friday = dates("2026-03-13");
    const inner = cascade(layer(monday, 1), layer(friday, 2));
    const source = cascade(replace(monday.or(friday), inner));

    // When both dates are in the validation window.
    const result = validate(source, week());

    // Then neither child is reported inactive in the other child's region.
    assertArrayEmpty(result);
  });

  it.each(["sum", "min", "max"] as const)(
    "uses the nested %s strategy",
    (strategy) => {
      // Given overlapping contributions inside an outer override cascade.
      const inner = merged(strategy, layer(always(), 1), layer(always(), 2));
      const source = cascade(replace(always(), inner));

      // When the nested contributions are validated.
      const result = validate(source, week());

      // Then both remain reachable under their own merge strategy.
      assertArrayEmpty(result);
    },
  );

  it("uses nested override inside an additive parent", () => {
    // Given an override replacement inside an additive cascade.
    const inner = cascade(layer(always(), 1), layer(always(), 2));
    const source = merged("sum", replace(always(), inner), layer(always(), 3));

    // When the overlapping outer contribution remains active.
    const result = validate(source, week());

    // Then only the overridden inner assignment is shadowed.
    assertArrayEquals(
      result.map((d) => `${d.code}:${"path" in d ? d.path : ""}`),
      ["shadowed-layer:layers[0].replace.layers[0]"],
    );
  });

  it("lets an empty replacement hide additive children", () => {
    // Given a nested replacement that claims all time without assigning it.
    const inner = merged(
      "sum",
      layer(always(), 1),
      replace(always(), cascade<number>()),
    );
    const source = cascade(replace(always(), inner));

    // When validation also requires full coverage.
    const result = validate(source, week(), { requireFullCoverage: true });

    // Then the assignment is hidden and the final result has one gap.
    assertArrayEquals(
      result.map((d) => `${d.code}:${"path" in d ? d.path : ""}`),
      ["shadowed-layer:layers[0].replace.layers[0]", "uncovered-time:"],
    );
  });
});
