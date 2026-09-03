import { render, when } from "#test/intervals.js";
import {
  assertArrayEmpty,
  assertArrayLength,
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { always, dates, weekdays, weekends } from "./build.js";
import { cascade, layer, merged } from "./cascade.js";
import { type ValidationWindow, validate } from "./semantic-validation.js";

describe("semantic validation", () => {
  const aWeek = () => ({
    from: when("2026-03-09T00:00"),
    to: when("2026-03-16T00:00"),
  });

  it("reports a rule that is inactive throughout the window", () => {
    // Given a rule whose two parts cannot overlap during the week.
    const impossible = weekdays().and(weekends());
    const week = aWeek();

    // When the rule is validated.
    const diagnostics = validate(impossible, week);

    // Then the report says the rule is inactive in that window.
    assertIdentical(
      diagnostics.map(({ code }) => code).join(","),
      "inactive-rule",
    );
  });

  it("reports a layer that is inactive throughout the window", () => {
    // Given a dated layer after the validation window.
    const future = cascade(layer(dates("2027-01-01"), "alice"));
    const week = aWeek();

    // When the cascade is validated.
    const diagnostics = validate(future, week);

    // Then the report points to the inactive layer.
    assertIdentical(
      diagnostics.map(({ code }) => code).join(","),
      "inactive-layer",
    );
    const paths = diagnostics.flatMap((diagnostic) =>
      "path" in diagnostic ? [diagnostic.path] : [],
    );
    assertIdentical(paths.join(","), "layers[0]");
  });

  it("reports a layer hidden by later override layers", () => {
    // Given a weekday assignment followed by an assignment covering all time.
    const hidden = cascade(layer(weekdays(), "alice"), layer(always(), "bob"));
    const week = aWeek();

    // When the cascade is validated.
    const diagnostics = validate(hidden, week);

    // Then the lower layer is reported as shadowed.
    assertIdentical(
      diagnostics.map(({ code }) => code).join(","),
      "shadowed-layer",
    );
    const paths = diagnostics.flatMap((diagnostic) =>
      "path" in diagnostic ? [diagnostic.path] : [],
    );
    assertIdentical(paths.join(","), "layers[0]");
  });

  it("keeps overlapping additive layers active", () => {
    // Given two numeric layers that contribute over the same time.
    const staffing = merged("sum", layer(always(), 2), layer(always(), 3));
    const day = {
      from: when("2026-03-09T00:00"),
      to: when("2026-03-10T00:00"),
    };

    // When the additive cascade is validated.
    const diagnostics = validate(staffing, day);

    // Then neither contributing layer is called shadowed.
    assertArrayEmpty(diagnostics);
  });

  it("reports every interval without an assigned value", () => {
    // Given a rota-like cascade that assigns weekdays only.
    const weekdaysOnly = cascade(layer(weekdays(), "alice"));
    const week = aWeek();

    // When full coverage is required.
    const diagnostics = validate(weekdaysOnly, week, {
      requireFullCoverage: true,
    });

    // Then the weekend is reported as uncovered.
    const gaps = diagnostics.flatMap((diagnostic) =>
      diagnostic.code === "uncovered-time" ? [diagnostic.interval] : [],
    );
    assertArrayLength(diagnostics, 1);
    assertIdentical(render(gaps), "[2026-03-14T00:00:00,2026-03-16T00:00:00)");
  });

  it("returns no diagnostics for a complete rota", () => {
    // Given assignments that cover the whole week without shadowing.
    const complete = cascade(
      layer(weekdays(), "alice"),
      layer(weekends(), "bob"),
    );
    const week = aWeek();

    // When the cascade is validated with full coverage required.
    const diagnostics = validate(complete, week, {
      requireFullCoverage: true,
    });

    // Then the report is empty.
    assertArrayEmpty(diagnostics);
  });

  it("requires the validation window to have an end", () => {
    // Given a context whose end is absent at runtime.
    const openEnded = {
      from: when("2026-03-09T00:00"),
    } as ValidationWindow;

    // When semantic validation is attempted.
    const error = assertThrowsError(() => validate(always(), openEnded));

    // Then it refuses a window that cannot prove an empty result.
    assertInstanceOf(error, RangeError);
    assertIdentical(
      error.message,
      "Validation requires a finite window with `to`.",
    );
  });
});
