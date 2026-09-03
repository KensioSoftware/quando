import { render, renderValued, when } from "#test/intervals.js";
import { faker } from "@faker-js/faker";
import {
  assertArrayEquals,
  assertArrayEmpty,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { dates, weekdays, weekends } from "./build.js";
import { cascade, layer } from "./cascade.js";
import { asString } from "./parse-shape.js";
import { parseRota, rota } from "./rota.js";
import { take } from "./stream.js";

describe("a rota", () => {
  const MONDAY = when("2026-03-09T00:00");
  const NEXT_MONDAY = when("2026-03-16T00:00");

  /**
   * Weekdays to one person, weekends to another, and the Wednesday swapped to
   * a third. Fresh names each call, so no test can lean on another's.
   */
  const anOnCallRota = () => {
    const [weekday = "", weekend = "", covering = ""] =
      faker.helpers.uniqueArray(() => faker.person.firstName(), 3);

    return {
      weekday,
      weekend,
      covering,
      onCall: rota()
        .assign(weekdays(), weekday)
        .assign(weekends(), weekend)
        .swap("2026-03-11", covering),
    };
  };

  it("keeps its cascade as explicit data", () => {
    // Given a rota built through the domain vocabulary.
    const { weekday, weekend, covering, onCall } = anOnCallRota();

    // When its underlying data is compared with the low-level form.
    const byHand = cascade(
      layer(weekdays(), weekday),
      layer(weekends(), weekend),
      layer(dates("2026-03-11"), covering),
    );

    // Then the two cascade documents are the same.
    assertIdentical(JSON.stringify(onCall.cascade), JSON.stringify(byHand));
  });

  it("says who is on", () => {
    // Given the rota.
    const { weekday, weekend, onCall } = anOnCallRota();

    // When it is asked about a Monday morning and a Saturday morning.
    // Then each falls to whoever holds that part of the week.
    assertIdentical(onCall.whoIsOn(when("2026-03-09T10:00")), weekday);
    assertIdentical(onCall.whoIsOn(when("2026-03-14T10:00")), weekend);
  });

  it("explains who is on", () => {
    // Given the rota, including its Wednesday swap.
    const { weekday, covering, onCall } = anOnCallRota();

    // When the Wednesday assignment is explained.
    const explanation = onCall.explain(when("2026-03-11T10:00"));

    // Then the swap is the result after the usual assignment.
    assertIdentical(explanation.value, covering);
    assertArrayEquals(
      explanation.steps.map((step) =>
        step.type === "assignment" ? step.result : undefined,
      ),
      [weekday, covering],
    );
    assertStringIncludes(explanation.summary, "Wednesday is a weekday.");
    assertStringIncludes(explanation.summary, "The date is 2026-03-11.");
    assertStringIncludes(
      explanation.summary,
      `assigns ${JSON.stringify(covering)}`,
    );
  });

  it("adds rota labels and comments to an explanation", () => {
    // Given an assignment with a team name and a note about its responsibility.
    const onCall = rota().assign(weekdays(), "alice", {
      label: "Primary support",
      comment: "Alice handles weekday incidents.",
    });

    // When a weekday assignment is explained.
    const explanation = onCall.explain(when("2026-03-11T10:00"));

    // Then the caller's terms appear beside Quando's automatic explanation.
    assertIdentical(explanation.steps[0]?.label, "Primary support");
    assertIdentical(
      explanation.steps[0].comment,
      "Alice handles weekday incidents.",
    );
    assertStringIncludes(explanation.summary, "Primary support.");
    assertStringIncludes(explanation.summary, "Wednesday is a weekday.");
  });

  it("restores its methods after storage", () => {
    // Given a rota that has passed through JSON storage.
    const stored = JSON.stringify(rota().assign(weekdays(), "alice"));

    // When the stored rota is parsed and a weekend assignment is added.
    const restored = parseRota(JSON.parse(stored), asString).assign(
      weekends(),
      "bob",
    );

    // Then both assignments are available through the rota API.
    assertIdentical(restored.whoIsOn(when("2026-03-09T10:00")), "alice");
    assertIdentical(restored.whoIsOn(when("2026-03-14T10:00")), "bob");
  });

  it("gives a swapped day to whoever took it", () => {
    // Given the rota, whose Wednesday has been swapped.
    const { covering, onCall } = anOnCallRota();

    // When it is asked about that Wednesday.
    // Then the swap wins over the weekday cover beneath it.
    assertIdentical(onCall.whoIsOn(when("2026-03-11T10:00")), covering);
  });

  it("says nobody when nothing covers the moment", () => {
    // Given a rota that only covers weekdays.
    const weekdaysOnly = rota().assign(weekdays(), faker.person.firstName());

    // When it is asked about a Saturday.
    // Then nobody is on. An unassigned moment has no value to give.
    assertUndefined(weekdaysOnly.whoIsOn(when("2026-03-14T10:00")));
    assertStringIncludes(
      weekdaysOnly.explain(when("2026-03-14T10:00")).summary,
      "Nobody is assigned",
    );
  });

  it("hands back each stretch and who has it", () => {
    // Given the rota.
    const { weekday, weekend, covering, onCall } = anOnCallRota();

    // When a week of shifts is read off it.
    const week = onCall.shifts(MONDAY, NEXT_MONDAY);

    // Then the week arrives in four stretches, split where the swap falls.
    assertIdentical(
      renderValued(week),
      `[2026-03-09T00:00:00,2026-03-11T00:00:00)=${weekday} ` +
        `[2026-03-11T00:00:00,2026-03-12T00:00:00)=${covering} ` +
        `[2026-03-12T00:00:00,2026-03-14T00:00:00)=${weekday} ` +
        `[2026-03-14T00:00:00,2026-03-16T00:00:00)=${weekend}`,
    );
  });

  it("reports times when nobody is assigned", () => {
    // Given a rota that assigns weekdays only.
    const weekdaysOnly = rota().assign(weekdays(), faker.person.firstName());

    // When the rota is validated over a whole week.
    const diagnostics = weekdaysOnly.validate(MONDAY, NEXT_MONDAY);

    // Then its uncovered weekend is reported.
    const gaps = diagnostics.flatMap((diagnostic) =>
      diagnostic.code === "uncovered-time" ? [diagnostic.interval] : [],
    );
    assertIdentical(render(gaps), "[2026-03-14T00:00:00,2026-03-16T00:00:00)");
  });

  it("accepts a rota that covers its whole validation window", () => {
    // Given the complete weekday and weekend rota.
    const { onCall } = anOnCallRota();

    // When it is validated over the week.
    const diagnostics = onCall.validate(MONDAY, NEXT_MONDAY);

    // Then no problems are found.
    assertArrayEmpty(diagnostics);
  });

  it("runs on for as long as it is asked to", () => {
    // Given a weekday rota and no end to read it up to.
    const name = faker.person.firstName();
    const rolling = rota().assign(weekdays(), name);
    const shifts = rolling.shifts(MONDAY);

    // When two shifts are taken. Taking is what stops it.
    const fortnight = take(shifts, 2);

    // Then they are this week's and next week's.
    assertIdentical(
      renderValued(fortnight),
      `[2026-03-09T00:00:00,2026-03-14T00:00:00)=${name} ` +
        `[2026-03-16T00:00:00,2026-03-21T00:00:00)=${name}`,
    );
  });

  describe("the value type", () => {
    it("narrows to the names actually assigned", () => {
      // Given a rota whose names are written as literals. They stay literals
      // here because the type is what this test is about, and a name from
      // faker would widen to `string` and prove nothing.
      const onCall = rota()
        .assign(weekdays(), "alice")
        .assign(weekends(), "bob");

      // When someone is read off it.
      // Then the type is the union of the two names, so a switch over it can
      // be exhaustive. The annotation is the assertion, checked by the
      // compiler.
      const who: "alice" | "bob" | undefined = onCall.whoIsOn(MONDAY);

      assertIdentical(who, "alice");
    });

    it("takes a declared type when the values are not known up front", () => {
      // Given a roster of how many people are working, declared as numbers.
      const count = faker.number.int({ min: 1, max: 12 });
      const staffing = rota<number>().assign(weekdays(), count);

      // When a weekday is read.
      const many: number | undefined = staffing.whoIsOn(
        when("2026-03-09T10:00"),
      );

      // Then the count comes back at the declared type.
      assertIdentical(many, count);
    });
  });

  describe("what it refuses", () => {
    it("says so when a day is not a date", () => {
      // Given a swap written the way someone would say it out loud.
      const said = "next Tuesday";

      // When the swap is added.
      const error = assertThrowsError(() =>
        rota().swap(said, faker.person.firstName()),
      );

      // Then it is refused where it was written.
      assertInstanceOf(error, RangeError);
    });

    it("validates the stored envelope", () => {
      // Given invalid outer values, a wrong tag, and an unknown field.
      const values: readonly unknown[] = [
        null,
        [],
        "rota",
        { type: "schedule", cascade: cascade<string>() },
        { type: "rota", cascade: cascade<string>(), person: "alice" },
      ];

      // When each is parsed.
      // Then each is rejected by the rota parser.
      for (const value of values) {
        const error = assertThrowsError(() => parseRota(value, asString));
        assertInstanceOf(error, TypeError);
      }
    });

    it("requires override merge semantics", () => {
      // Given a stored rota that requests concatenation.
      const stored = {
        type: "rota",
        cascade: { type: "cascade", merge: "concat", layers: [] },
      };

      // When it is parsed.
      const error = assertThrowsError(() => parseRota(stored, asString));

      // Then the message names the rota's merge rule.
      assertStringIncludes(error.message, "a rota uses override");
    });
  });
});
