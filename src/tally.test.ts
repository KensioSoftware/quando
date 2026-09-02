import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { weekdays, weekends } from "./build.js";
import { equals } from "./canonical.js";
import { cascade, layer, merged } from "./cascade.js";
import { tally } from "./tally.js";

describe("counting how many are on", () => {
  const monday = Temporal.ZonedDateTime.from("2026-03-09T11:00[Europe/London]");
  const wednesday = Temporal.ZonedDateTime.from(
    "2026-03-11T11:00[Europe/London]",
  );
  const saturday = Temporal.ZonedDateTime.from(
    "2026-03-14T11:00[Europe/London]",
  );

  const weekStart = Temporal.ZonedDateTime.from(
    "2026-03-09T00:00[Europe/London]",
  );
  const weekEnd = Temporal.ZonedDateTime.from(
    "2026-03-16T00:00[Europe/London]",
  );

  describe("plus", () => {
    it("adds where two lines cover the same day", () => {
      // Given a warehouse with a standing crew and extra cover on one day,
      // said the way a manager would say it.
      const staff = tally().plus(weekdays(), 3).plus("2026-03-11", 2);

      // When each day is asked.
      // Then the Wednesday has both, and the other weekdays have the crew.
      assertIdentical(staff.at(monday), 3);
      assertIdentical(staff.at(wednesday), 5);
    });

    it("is zero where nothing covers the moment", () => {
      // Given cover on weekdays only.
      const staff = tally().plus(weekdays(), 3);

      // When a Saturday is asked.
      // Then the answer is nobody. A cascade leaves an unclaimed moment out
      // of its stream, and nobody rostered is nobody there.
      assertIdentical(staff.at(saturday), 0);
    });
  });

  describe("exactly", () => {
    it("replaces the figure rather than adding to it", () => {
      // Given a standing crew, and a skeleton crew on one day. Said as a
      // `plus` this would be four, and what the manager means is one.
      const staff = tally().plus(weekdays(), 3).exactly("2026-03-11", 1);

      // When the two days are asked.
      // Then the exception replaced the figure under it.
      assertIdentical(staff.at(monday), 3);
      assertIdentical(staff.at(wednesday), 1);
    });

    it("is still added to by a line written after it", () => {
      // Given a skeleton crew for a day, and cover added after it. "Exactly"
      // is about the figure rather than the last word on it: the line
      // outranks everything above it, and a later `plus` still adds.
      const staff = tally()
        .plus(weekdays(), 3)
        .exactly("2026-03-11", 1)
        .plus("2026-03-11", 2);

      // When the day is asked.
      // Then the later line added to the replacement.
      assertIdentical(staff.at(wednesday), 3);
    });
  });

  describe("least", () => {
    it("finds the thinnest cover in a window", () => {
      // Given a week with more people on some days than others.
      const staff = tally().plus(weekdays(), 3).plus(weekends(), 1);

      // When the whole week is asked.
      // Then the weekend figure is the one that limits it, which is the
      // question a capacity check is really asking.
      assertIdentical(staff.least(weekStart, weekEnd), 1);
    });

    it("is zero where any of the window is uncovered", () => {
      // Given cover on weekdays only, and a window running into the weekend.
      const staff = tally().plus(weekdays(), 3);

      // When the whole week is asked.
      // Then the answer is nobody, however well covered the weekdays are. A
      // stretch no line claims is a stretch with nobody on.
      assertIdentical(staff.least(weekStart, weekEnd), 0);
    });

    it("is zero for a window nothing covers at all", () => {
      // Given cover on weekdays, asked about a weekend.
      const staff = tally().plus(weekdays(), 3);

      // When only the weekend is asked.
      // Then nobody, rather than the absence of an answer.
      assertIdentical(
        staff.least(
          Temporal.ZonedDateTime.from("2026-03-14T00:00[Europe/London]"),
          Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
        ),
        0,
      );
    });
  });

  describe("counts", () => {
    it("gives each stretch and how many are on for it", () => {
      // Given a week with extra cover in the middle of it.
      const staff = tally().plus(weekdays(), 3).plus("2026-03-11", 2);

      // When the week is read as stretches.
      const shown = [...staff.counts(weekStart, weekEnd)].map((span) => {
        const day = span.start?.toPlainDate().toString() ?? "";
        return `${day} ${span.value}`;
      });

      // Then the extra day is its own stretch, and the days either side of it
      // are the standing figure.
      assertArrayEquals(shown, [
        "2026-03-09 3",
        "2026-03-11 5",
        "2026-03-12 3",
      ]);
    });
  });

  describe("what it is underneath", () => {
    it("is the cascade the low-level form builds", () => {
      // Given the same roster said both ways.
      const plainly = tally().plus(weekdays(), 3).plus(weekends(), 1);
      const built = merged("sum", layer(weekdays(), 3), layer(weekends(), 1));

      // When the two are compared.
      // Then they are the same document. The words are a way of saying the
      // cascade, rather than a second thing to keep in step with it.
      assertTrue(equals(plainly, built));
    });

    it("resolves as any other cascade does", () => {
      // Given a tally handed to `resolve` directly, without its own methods.
      const staff = tally().plus(weekdays(), 3);
      const plain = cascade(...staff.layers);

      // When both are read over the same week.
      // Then a `Tally` is a `Cascade<number>` and reads as one, which is what
      // makes everything that takes a cascade take one of these.
      assertIdentical(staff.merge, "sum");
      assertArrayLength(plain.layers, 1);
    });
  });
});
