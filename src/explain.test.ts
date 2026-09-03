import { when } from "#test/intervals.js";
import {
  assertArrayEmpty,
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertStringIncludes,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { always, dates, daysOfWeek, timeOfDay, weekdays } from "./build.js";
import { cascade, layer, merged, replace } from "./cascade.js";
import { explain } from "./explain.js";

describe("explaining a cascade", () => {
  it("explains a cascade with no layers", () => {
    // Given an empty cascade.
    // When one instant is explained.
    const explanation = explain(cascade<string>(), when("2026-03-11T10:00"));

    // Then the missing value has a readable cause.
    assertUndefined(explanation.value);
    assertArrayEmpty(explanation.steps);
    assertArrayEmpty(explanation.skipped);
    assertStringIncludes(
      explanation.summary,
      "No layer exists to assign a value.",
    );
  });

  it("shows each matching assignment and its running result", () => {
    // Given a weekday rota with a higher-priority swap on Wednesday.
    const usual = weekdays();
    const swapped = dates("2026-03-11");
    const onCall = cascade(layer(usual, "alice"), layer(swapped, "bob"));

    // When the Wednesday assignment is explained.
    const explanation = explain(onCall, when("2026-03-11T10:00"));

    // Then both matching layers show how the final value became Bob.
    assertIdentical(explanation.value, "bob");
    assertIdentical(explanation.merge, "override");
    assertArrayEquals(
      explanation.steps.map((step) => step.path),
      ["layers[0]", "layers[1]"],
    );
    assertArrayEquals(
      explanation.steps.map((step) =>
        step.type === "assignment" ? step.result : undefined,
      ),
      ["alice", "bob"],
    );
    assertIdentical(explanation.steps[0]?.scope, usual);
    assertIdentical(explanation.steps[1]?.scope, swapped);
    assertStringIncludes(explanation.summary, "Wednesday is a weekday.");
    assertStringIncludes(explanation.summary, "The date is 2026-03-11.");
    assertStringIncludes(
      explanation.summary,
      'changes the value from "alice" to "bob"',
    );
  });

  it("includes caller labels and comments in the explanation", () => {
    // Given a dated closure with the business context Quando cannot infer.
    const closure = layer(dates("2026-12-25"), false, {
      label: "Christmas Day",
      comment: "The warehouse is closed for the public holiday.",
    });
    const openingHours = cascade(layer(weekdays(), true), closure);

    // When Christmas morning is explained.
    const explanation = explain(openingHours, when("2026-12-25T10:00"));
    const final = explanation.steps[1];

    // Then the domain context accompanies the automatic date explanation.
    assertIdentical(final?.label, "Christmas Day");
    assertIdentical(
      final.comment,
      "The warehouse is closed for the public holiday.",
    );
    assertStringIncludes(explanation.summary, "Christmas Day.");
    assertStringIncludes(explanation.summary, "The date is 2026-12-25.");
    assertStringIncludes(explanation.summary, "warehouse is closed");
  });

  it("explains non-matching layers separately from contributors", () => {
    // Given separate weekday and weekend assignments.
    const onCall = cascade(
      layer(weekdays(), "alice"),
      layer(daysOfWeek("saturday", "sunday"), "bob"),
    );

    // When a weekday is explained.
    const explanation = explain(onCall, when("2026-03-11T10:00"));

    // Then the result and the rejected alternative are both accounted for.
    assertArrayEquals(
      explanation.steps.map((step) => step.path),
      ["layers[0]"],
    );
    assertIdentical(explanation.skipped[0]?.reason, "did-not-match");
    assertStringIncludes(
      explanation.skipped[0].description,
      "Wednesday is not a weekend day.",
    );
    const skipped = explanation.skipped[0].description;
    assertStringIncludes(explanation.summary, skipped);
    assertArrayLength(explanation.summary.split(skipped), 2);
  });

  it("shows how a merge combines matching layers", () => {
    // Given a tally with a standing count and extra Wednesday cover.
    const staffing = merged(
      "sum",
      layer(weekdays(), 3),
      layer(dates("2026-03-11"), 2),
    );

    // When the Wednesday count is explained.
    const explanation = explain(staffing, when("2026-03-11T10:00"));

    // Then each step records the running sum.
    assertIdentical(explanation.value, 5);
    assertIdentical(explanation.merge, "sum");
    assertArrayEquals(
      explanation.steps.map((step) =>
        step.type === "assignment" ? step.result : undefined,
      ),
      [3, 5],
    );
  });

  it("starts again inside the highest matching replacement", () => {
    // Given ordinary hours replaced by a shorter Wednesday definition.
    const inner = cascade(
      layer(timeOfDay("09:00", "15:00"), true),
      layer(daysOfWeek("saturday"), false),
    );
    const openingHours = cascade(
      layer(weekdays(), true),
      replace(dates("2026-03-11"), inner),
    );

    // When a time inside the replacement is explained.
    const explanation = explain(openingHours, when("2026-03-11T10:00"));
    const replacement = explanation.steps[0];

    // Then the lower layer is explained as displaced by the replacement.
    assertTrue(explanation.value);
    assertArrayEquals(
      explanation.steps.map((step) => step.path),
      ["layers[1]"],
    );
    assertIdentical(replacement?.type, "replacement");
    assertTrue(replacement.explanation.value);
    assertArrayEquals(
      replacement.explanation.steps.map((step) => step.path),
      ["layers[1].replace.layers[0]"],
    );
    assertIdentical(explanation.skipped[0]?.reason, "replaced");
    assertStringIncludes(
      explanation.skipped[0].description,
      "A higher-priority replacement removes this matching layer.",
    );
    const nestedSkipped = replacement.explanation.skipped[0]?.description;
    assertNonNullable(nestedSkipped);
    assertStringIncludes(explanation.summary, nestedSkipped);
    assertArrayLength(explanation.summary.split(nestedSkipped), 2);
  });

  it("shows when a replacement deliberately leaves the instant unassigned", () => {
    // Given Wednesday hours that replace the usual day and end at three.
    const openingHours = cascade(
      layer(weekdays(), true),
      replace(dates("2026-03-11"), timeOfDay("09:00", "15:00")),
    );

    // When half past three on Wednesday is explained.
    const explanation = explain(openingHours, when("2026-03-11T15:30"));
    const replacement = explanation.steps[0];

    // Then the replacement is present with an empty inner trace.
    assertUndefined(explanation.value);
    assertIdentical(replacement?.type, "replacement");
    assertUndefined(replacement.explanation.value);
    assertArrayEmpty(replacement.explanation.steps);
  });

  it("continues merging layers above a replacement", () => {
    // Given a sum whose exact Wednesday value has another line above it.
    const exact = cascade(layer(always(), 1));
    const staffing = merged(
      "sum",
      layer(weekdays(), 3),
      replace(dates("2026-03-11"), exact),
      layer(dates("2026-03-11"), 2),
    );

    // When the Wednesday count is explained.
    const explanation = explain(staffing, when("2026-03-11T10:00"));

    // Then the replacement removes the lower three and the upper two is added.
    assertIdentical(explanation.value, 3);
    assertArrayEquals(
      explanation.steps.map((step) => step.path),
      ["layers[1]", "layers[2]"],
    );
    const upper = explanation.steps[1];
    assertIdentical(upper?.type, "assignment");
    assertIdentical(upper.result, 3);
  });

  it("returns an empty trace where no layer matches", () => {
    // Given a weekday-only cascade.
    const onCall = cascade(layer(weekdays(), "alice"));

    // When a Saturday is explained.
    const explanation = explain(onCall, when("2026-03-14T10:00"));

    // Then no value is reported and the failed weekday condition is clear.
    assertUndefined(explanation.value);
    assertArrayEmpty(explanation.steps);
    assertIdentical(explanation.skipped[0]?.reason, "did-not-match");
    assertStringIncludes(
      explanation.summary,
      "Saturday is not a weekday. This layer does not apply.",
    );
  });
});
