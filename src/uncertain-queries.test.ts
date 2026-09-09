import { when } from "#test/intervals.js";
import {
  assertArrayEquals,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { all, timeOfDay, weekdays } from "./build.js";
import { advanceByCoveredDays } from "./covered-days.js";
import {
  certainly,
  chances,
  type Distribution,
  type Spread,
  spread,
} from "./estimate.js";
import { mapOutcomes } from "./estimate-outcomes.js";
import { chanceBefore, median, quantile, support } from "./estimate-views.js";
import { advanceBy, nextCoveredInterval } from "./query.js";
import type { Rule } from "./rule.js";

describe("answering with an estimate", () => {
  /** A courier that works weekday office hours. */
  const courier = (): Rule => all(weekdays(), timeOfDay("09:00", "17:00"));

  /** Friday afternoon, with the weekend between here and any working day. */
  const placed = (): Temporal.ZonedDateTime => when("2026-03-13T14:00");

  /** A datetime as the day and time it names, for readable assertions. */
  const reading = (at: Temporal.ZonedDateTime): string =>
    at.toPlainDateTime().toString();

  /** The courier's own figures: 25% next working day, 50% second, 25% third. */
  const workingDays = (): Distribution<number> =>
    chances([
      { value: 1, probability: 0.25 },
      { value: 2, probability: 0.5 },
      { value: 3, probability: 0.25 },
    ]);

  describe("one to three working days, through the calendar", () => {
    it("gives the plain range back where no weights were supplied", () => {
      // Given an order placed on a Friday afternoon, and a courier who says
      // one to three working days and nothing more.
      const arrival: Spread<Temporal.ZonedDateTime> = advanceByCoveredDays(
        placed(),
        spread([1, 2, 3]),
        { during: courier() },
      );

      // When the outcomes are read.
      // Then the weekend is where it should be. One working day from a Friday
      // is the Monday, and each answer is when the courier opens that day.
      assertArrayEquals(arrival.values.map(reading), [
        "2026-03-16T09:00:00",
        "2026-03-17T09:00:00",
        "2026-03-18T09:00:00",
      ]);
    });

    it("carries the weights on to the dates they land on", () => {
      // Given the same order with the courier's own figures behind it.
      const arrival = advanceByCoveredDays(placed(), workingDays(), {
        during: courier(),
      });

      // When the outcomes are read.
      // Then each weight sits on the datetime its working day resolved to.
      assertArrayEquals(
        arrival.outcomes.map((outcome) => ({
          at: reading(outcome.value),
          probability: outcome.probability,
        })),
        [
          { at: "2026-03-16T09:00:00", probability: 0.25 },
          { at: "2026-03-17T09:00:00", probability: 0.5 },
          { at: "2026-03-18T09:00:00", probability: 0.25 },
        ],
      );
    });

    it("answers the range, the headline date and the commitment from one call", () => {
      // Given the arrival estimate.
      const arrival = advanceByCoveredDays(placed(), workingDays(), {
        during: courier(),
      });

      // When each view is read.
      const range = support(arrival);

      // Then the customer sees Monday to Wednesday, the headline is Tuesday,
      // and a 95% commitment has to say Wednesday.
      assertIdentical(reading(range[0] ?? placed()), "2026-03-16T09:00:00");
      assertIdentical(reading(range[2] ?? placed()), "2026-03-18T09:00:00");
      assertIdentical(reading(median(arrival)), "2026-03-17T09:00:00");
      assertIdentical(reading(quantile(arrival, 0.95)), "2026-03-18T09:00:00");
    });

    it("says how likely it lands before a date somebody cares about", () => {
      // Given the arrival estimate, and a cut-off on the Wednesday morning.
      const arrival = advanceByCoveredDays(placed(), workingDays(), {
        during: courier(),
      });

      // When the chance of beating that cut-off is asked for.
      // Then it is the quarter and the half that land before it.
      assertIdentical(chanceBefore(arrival, when("2026-03-18T00:00")), 0.75);
    });

    it("refuses an outcome the search never reaches", () => {
      // Given a search window far too small for the second outcome.
      const asking = (): Spread<Temporal.ZonedDateTime> =>
        advanceByCoveredDays(placed(), spread([1, 20]), {
          during: courier(),
          within: Temporal.Duration.from("P3D"),
        });

      // When the estimate is resolved.
      const refusal = assertThrowsError(asking);

      // Then it is refused. Dropping that outcome would leave a distribution
      // missing part of its mass, and every quantile drawn from it wrong.
      assertInstanceOf(refusal, RangeError);
      assertStringIncludes(refusal.message, "Widen `within`");
    });
  });

  describe("elapsed time, through the same rules", () => {
    it("estimates where an uncertain amount of working time gets to", () => {
      // Given a job starting an hour before closing on a Friday, taking either
      // half an hour or two hours of the courier's working time.
      const started = when("2026-03-13T16:00");
      const packing = spread([
        Temporal.Duration.from("PT30M"),
        Temporal.Duration.from("PT2H"),
      ]);

      // When it is advanced through the courier's hours.
      const done = advanceBy(started, packing, { during: courier() });

      // Then the short one finishes on the Friday and the long one runs an
      // hour into Monday, because the hour after five o'clock does not count.
      assertArrayEquals(done.values.map(reading), [
        "2026-03-13T16:30:00",
        "2026-03-16T10:00:00",
      ]);
    });
  });

  describe("outcomes that land in the same place", () => {
    it("adds their probability together", () => {
      // Given a wait in calendar days from a Friday morning. One day is the
      // Saturday, two is the Sunday, and four is the Tuesday.
      const from = when("2026-03-13T07:00");
      const waiting = chances([
        { value: 1, probability: 0.2 },
        { value: 2, probability: 0.3 },
        { value: 4, probability: 0.5 },
      ]);

      // When each outcome is asked when the courier is next open.
      const opening = mapOutcomes(
        waiting,
        (days) =>
          nextCoveredInterval(courier(), {
            from: from.add({ days }),
            to: from.add({ days: days + 14 }),
          })?.start ?? from,
      );

      // Then the Saturday and the Sunday both come out at Monday morning, and
      // their halves of the probability are one answer.
      assertArrayEquals(
        opening.outcomes.map((outcome) => ({
          at: reading(outcome.value),
          probability: outcome.probability,
        })),
        [
          { at: "2026-03-16T09:00:00", probability: 0.5 },
          { at: "2026-03-17T09:00:00", probability: 0.5 },
        ],
      );
    });
  });

  describe("a caller who never mentions probability", () => {
    it("gets the same answer from a count as it always did", () => {
      // Given the order, and two working days asked for as a plain count.
      const arrival = advanceByCoveredDays(placed(), 2, {
        during: courier(),
      });

      // When the answer is read.
      // Then it is one datetime, with nothing wrapped around it.
      assertInstanceOf(arrival, Temporal.ZonedDateTime);
      assertIdentical(reading(arrival), "2026-03-17T09:00:00");
    });

    it("gets the same answer from a duration as it always did", () => {
      // Given a job of half an hour, asked for as a plain duration.
      const done = advanceBy(
        when("2026-03-13T16:00"),
        Temporal.Duration.from("PT30M"),
        { during: courier() },
      );

      // When the answer is read.
      // Then it is one datetime.
      assertInstanceOf(done, Temporal.ZonedDateTime);
      assertIdentical(reading(done), "2026-03-13T16:30:00");
    });

    it("puts a certain outcome where the plain count puts it", () => {
      // Given two working days written as an estimate of one outcome.
      const arrival = advanceByCoveredDays(placed(), certainly(2), {
        during: courier(),
      });

      // When it is read.
      // Then it landed where the plain count landed, at a probability of one.
      assertArrayEquals(
        arrival.outcomes.map((outcome) => ({
          at: reading(outcome.value),
          probability: outcome.probability,
        })),
        [{ at: "2026-03-17T09:00:00", probability: 1 }],
      );
    });
  });
});
