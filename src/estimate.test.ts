import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertNumberToNearest,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  assumeUniform,
  certainly,
  chances,
  type Distribution,
  type Estimate,
  isDistribution,
  spread,
} from "./estimate.js";
import { combineOutcomes, mapOutcomes } from "./estimate-outcomes.js";
import {
  chanceBefore,
  median,
  mode,
  quantile,
  support,
} from "./estimate-views.js";

describe("estimating an answer with several outcomes", () => {
  /** The courier's own numbers: 25% next day, 50% the second, 25% the third. */
  const delivery = (): Distribution<number> =>
    chances([
      { value: 1, probability: 0.25 },
      { value: 2, probability: 0.5 },
      { value: 3, probability: 0.25 },
    ]);

  /** The probability an outcome carries, or nothing where it is absent. */
  const weightOf = (over: Distribution<number>, value: number): number =>
    over.outcomes.find((outcome) => outcome.value === value)?.probability ?? 0;

  describe("building one", () => {
    it("takes the outcomes alone, with no weights attached", () => {
      // Given the plain reading of "one to three working days".
      const days = spread([1, 2, 3]);

      // When it is read back.
      // Then it carries the outcomes and nothing that weighs them.
      assertArrayEquals([...days.values], [1, 2, 3]);
      assertFalse(isDistribution(days));
    });

    it("takes weights that total one", () => {
      // Given the courier's own figures.
      const days = delivery();

      // When they are read back.
      // Then each outcome kept the weight it was given.
      assertIdentical(weightOf(days, 2), 0.5);
      assertTrue(isDistribution(days));
    });

    it("refuses weights totalling anything but one", () => {
      // Given weights that come to 0.9, which is a mistake upstream.
      const writing = (): Distribution<number> =>
        chances([
          { value: 1, probability: 0.4 },
          { value: 2, probability: 0.5 },
        ]);

      // When the distribution is built.
      const refusal = assertThrowsError(writing);

      // Then it is refused, and the message says what they came to. Scaling
      // them up here would decide which of the two was wrong.
      assertInstanceOf(refusal, RangeError);
      assertStringIncludes(refusal.message, "total 0.9");
    });

    it("refuses an outcome that cannot happen", () => {
      // Given an outcome at zero probability.
      const writing = (): Distribution<number> =>
        chances([
          { value: 1, probability: 1 },
          { value: 2, probability: 0 },
        ]);

      // When the distribution is built.
      const refusal = assertThrowsError(writing);

      // Then it is refused as an outcome to leave out.
      assertInstanceOf(refusal, RangeError);
      assertStringIncludes(refusal.message, "above zero");
    });

    it("refuses an estimate with no outcomes at all", () => {
      // Given nothing to estimate over, both ways of saying it.
      // When either is built.
      // Then both are refused, because neither describes anything.
      assertInstanceOf(
        assertThrowsError(() => spread([])),
        RangeError,
      );
      assertInstanceOf(
        assertThrowsError(() => chances([])),
        RangeError,
      );
    });

    it("makes a known answer an estimate of one outcome", () => {
      // Given a step that is not in doubt.
      const packing = certainly(2);

      // When it is read as a distribution.
      // Then it is that one outcome at a probability of one.
      assertArrayLength([...packing.outcomes], 1);
      assertIdentical(weightOf(packing, 2), 1);
    });
  });

  describe("weights are the caller's to supply", () => {
    it("refuses a median for a spread, and names the way to opt in", () => {
      // Given "one to three working days" with no weights behind it.
      const days = spread([1, 2, 3]);

      // When a median is asked for anyway. TypeScript refuses this too, and
      // the cast is what a JavaScript caller reaches the check by.
      const asking = (): number =>
        median(days as unknown as Distribution<number>);

      // Then it is refused, the message names the opt in, and it names the
      // function the caller actually called.
      const refusal = assertThrowsError(asking);
      assertInstanceOf(refusal, RangeError);
      assertStringIncludes(refusal.message, "assumeUniform()");
      assertStringIncludes(refusal.message, "median()");
    });

    it("marks a uniform reading as assumed", () => {
      // Given a spread the caller is content to read as uniform.
      const days = assumeUniform(spread([1, 2, 3]));

      // When it is read back.
      // Then every outcome carries a third, and the assumption is on the face
      // of it.
      assertNumberToNearest(weightOf(days, 1), 0.3333, 0.0001);
      assertTrue(days.assumed);
    });

    it("carries the assumption through a mapping", () => {
      // Given an assumed distribution over days.
      const days = assumeUniform(spread([1, 2, 3]));

      // When every outcome is doubled.
      const doubled = mapOutcomes(days, (count) => count * 2);

      // Then the answer is still an answer resting on an assumption.
      assertTrue(doubled.assumed);
    });

    it("carries the assumption through a combination", () => {
      // Given one assumed estimate and one the caller supplied weights for.
      const assumed = assumeUniform(spread([1, 2]));
      const supplied = delivery();

      // When the two are combined.
      const both = combineOutcomes(
        assumed,
        supplied,
        (one, other) => one + other,
      );

      // Then the result rests on the assumption, because half of it does.
      assertTrue(both.assumed);
    });

    it("leaves supplied weights unmarked", () => {
      // Given two estimates the caller supplied weights for.
      // When they are combined.
      const both = combineOutcomes(delivery(), delivery(), (a, b) => a + b);

      // Then nothing was assumed on the caller's behalf.
      assertUndefined(both.assumed);
    });
  });

  describe("reading one", () => {
    it("shows the support in order, each outcome once", () => {
      // Given outcomes out of order, with one of them repeated.
      const days = spread([3, 1, 2, 1]);

      // When the support is read.
      // Then it is the range an end user is shown.
      assertArrayEquals([...support(days)], [1, 2, 3]);
    });

    it("names the likeliest outcome", () => {
      // Given the courier's figures, where the second day carries half.
      // When the mode is read.
      // Then it is that second day.
      assertIdentical(mode(delivery()), 2);
    });

    it("names the earlier of two equally likely outcomes", () => {
      // Given two outcomes that split the probability evenly.
      const either = chances([
        { value: 5, probability: 0.5 },
        { value: 4, probability: 0.5 },
      ]);

      // When the mode is read.
      // Then the earlier one answers, because a tie has to break somewhere.
      assertIdentical(mode(either), 4);
    });

    it("reads a quantile as the first outcome the share reaches", () => {
      // Given the courier's figures. The running total is 0.25 at day one,
      // 0.75 at day two and 1 at day three.
      const days = delivery();

      // When each share is asked for.
      // Then day two answers the median, and day three the 95% commitment.
      assertIdentical(quantile(days, 0.25), 1);
      assertIdentical(median(days), 2);
      assertIdentical(quantile(days, 0.95), 3);
    });

    it("reads the smallest outcome at a share of nothing", () => {
      // Given the courier's figures.
      // When a share of zero is asked for.
      // Then the first outcome answers.
      assertIdentical(quantile(delivery(), 0), 1);
    });

    it("answers how likely the result comes in below a value", () => {
      // Given the courier's figures.
      const days = delivery();

      // When each cut-off is asked about.
      // Then the count is of outcomes strictly below it, matching the
      // half-open intervals the rest of the library counts with.
      assertIdentical(chanceBefore(days, 3), 0.75);
      assertIdentical(chanceBefore(days, 1), 0);
      assertIdentical(chanceBefore(days, 99), 1);
    });

    it("answers the last outcome where the weights fall a hair short", () => {
      // Given weights that total a whisker under one, which chances() allows
      // because floating point arithmetic produces such totals honestly.
      const days = chances([
        { value: 1, probability: 0.5 },
        { value: 2, probability: 0.4999999995 },
      ]);

      // When the whole of the probability is asked for.
      // Then the last outcome answers, and the running total running out is
      // not allowed to leave the caller with nothing.
      assertIdentical(quantile(days, 1), 2);
    });

    it("refuses a distribution holding no outcomes at all", () => {
      // Given a distribution built by hand, past the builder that refuses it.
      const empty: Distribution<number> = {
        kind: "distribution",
        outcomes: [],
      };

      // When it is read.
      const refusal = assertThrowsError(() => mode(empty));

      // Then it is refused, and the message points at the builder.
      assertInstanceOf(refusal, RangeError);
      assertStringIncludes(refusal.message, "chances() refuses");
    });

    it("refuses a share outside nothing to everything", () => {
      // Given the courier's figures.
      // When a share above one is asked for.
      const refusal = assertThrowsError(() => quantile(delivery(), 1.5));

      // Then it is refused as a share that means nothing.
      assertInstanceOf(refusal, RangeError);
      assertStringIncludes(refusal.message, "from 0 to 1");
    });
  });

  describe("mapping every outcome", () => {
    it("adds the mass of two outcomes that land on the same answer", () => {
      // Given three outcomes where the first two lead to the same place. This
      // is what the calendar does to a count of days. A Saturday and a Sunday
      // both come out at Monday.
      const days = chances([
        { value: 1, probability: 0.2 },
        { value: 2, probability: 0.3 },
        { value: 4, probability: 0.5 },
      ]);

      // When each is mapped to where it lands.
      const landed = mapOutcomes(days, (count) =>
        count <= 2 ? "monday" : "tuesday",
      );

      // Then the two that met carry their masses together.
      assertArrayEquals(
        [...landed.outcomes],
        [
          { value: "monday", probability: 0.5 },
          { value: "tuesday", probability: 0.5 },
        ],
      );
    });

    it("keeps a spread a spread, with the outcomes it lands on", () => {
      // Given a spread with no weights.
      const days = spread([1, 2, 4]);

      // When every outcome is mapped somewhere two of them share.
      const landed = mapOutcomes(days, (count) =>
        count <= 2 ? "monday" : "tuesday",
      );

      // Then the answer is the two places it can land, still unweighted.
      assertFalse(isDistribution(landed));
      assertArrayEquals([...landed.values], ["monday", "tuesday"]);
    });
  });

  describe("combining two estimates", () => {
    it("multiplies the weights of independent outcomes", () => {
      // Given two independent deliveries on the courier's own figures.
      // When their totals are combined.
      const both = combineOutcomes(delivery(), delivery(), (a, b) => a + b);

      // Then the middle of the range carries far more than either end.
      // 0.25*0.25 for two, and 0.25*0.25 + 0.5*0.5 + 0.25*0.25 for four.
      assertIdentical(weightOf(both, 2), 0.0625);
      assertIdentical(weightOf(both, 3), 0.25);
      assertIdentical(weightOf(both, 4), 0.375);
      assertIdentical(weightOf(both, 6), 0.0625);
    });

    it("shows what reading the range alone would hide", () => {
      // Given two one-to-three ranges read as uniform.
      const first = assumeUniform(spread([1, 2, 3]));
      const second = assumeUniform(spread([1, 2, 3]));

      // When they are combined.
      const both = combineOutcomes(first, second, (a, b) => a + b);

      // Then the support is two to six, and quoting that alone is misleading.
      // Four is three times as likely as six.
      assertArrayEquals([...support(both)], [2, 3, 4, 5, 6]);
      assertNumberToNearest(weightOf(both, 4), 0.3333, 0.0001);
      assertNumberToNearest(weightOf(both, 6), 0.1111, 0.0001);
    });

    it("gives a spread back where either side carries no weights", () => {
      // Given one weighted estimate and one plain range.
      const packing = delivery();
      const queueing = spread([0, 1]);

      // When they are combined.
      const both: Estimate<number> = combineOutcomes(
        packing,
        queueing,
        (a, b) => a + b,
      );

      // Then the answer is a range, because there is no honest weight to put
      // on a pair drawn from something unweighted.
      assertFalse(isDistribution(both));
      assertArrayEquals([...support(both)], [1, 2, 3, 4]);
    });
  });

  describe("putting outcomes in order", () => {
    it("orders durations by how long they are", () => {
      // Given durations written out of order.
      const packing = spread([
        Temporal.Duration.from("PT2H"),
        Temporal.Duration.from("PT30M"),
      ]);

      // When the support is read.
      const ordered = support(packing);

      // Then the shorter one comes first.
      assertArrayEquals(
        ordered.map((one) => one.toString()),
        ["PT30M", "PT2H"],
      );
    });

    it("orders instants by when they are", () => {
      // Given two datetimes written out of order.
      const arrival = spread([
        Temporal.ZonedDateTime.from("2026-03-17T09:00[Europe/London]"),
        Temporal.ZonedDateTime.from("2026-03-16T09:00[Europe/London]"),
      ]);

      // When the support is read.
      const ordered = support(arrival);

      // Then the earlier one comes first.
      assertIdentical(ordered[0]?.toPlainDate().toString(), "2026-03-16");
    });

    it("refuses to order something with no order of its own", () => {
      // Given outcomes that are neither counts nor times.
      const shapes = spread([{ side: 3 }, { side: 4 }]);

      // When the support is read.
      const refusal = assertThrowsError(() => support(shapes));

      // Then it is refused, and the message names the way to say what the
      // order is.
      assertInstanceOf(refusal, RangeError);
      assertStringIncludes(refusal.message, "`order`");
    });

    it("orders an instant and a plain date by what they are", () => {
      // Given outcomes of the other shapes Temporal answers with.
      const instants = spread([
        Temporal.Instant.from("2026-03-17T09:00Z"),
        Temporal.Instant.from("2026-03-16T09:00Z"),
      ]);
      const dates = spread([
        Temporal.PlainDate.from("2026-03-17"),
        Temporal.PlainDate.from("2026-03-16"),
      ]);

      // When each support is read.
      // Then the earlier one comes first in both.
      assertIdentical(support(instants)[0]?.toString(), "2026-03-16T09:00:00Z");
      assertIdentical(support(dates)[0]?.toString(), "2026-03-16");
    });

    it("orders counts written as bigints", () => {
      // Given outcomes counted in nanoseconds, which overflow a number.
      const counted = spread([200n, 100n]);

      // When the support is read.
      // Then they come back smallest first.
      assertArrayEquals([...support(counted)], [100n, 200n]);
    });

    it("names what it could not order, whatever the outcome is", () => {
      // Given outcomes with no order of their own, in three shapes: a null, an
      // object of some class, and an object with no class at all.
      const shapes: readonly unknown[] = [
        [null, null],
        [new Map(), new Map()],
        [Object.create(null), Object.create(null)],
      ];

      // When each support is read.
      // Then each refusal says what it was looking at.
      const said = shapes.map(
        (pair) =>
          assertThrowsError(() => support(spread(pair as unknown[]))).message,
      );
      assertStringIncludes(said[0] ?? "", "null");
      assertStringIncludes(said[1] ?? "", "Map");
      assertStringIncludes(said[2] ?? "", "object");
    });

    it("refuses a NaN rather than reporting it equal to everything", () => {
      // Given an outcome that is not a number, arriving as one. NaN compares
      // false both ways round, which reads as "equal" to a comparison built on
      // less-than and greater-than.
      const broken = spread([Number.NaN, 1, 2]);

      // When the support is read.
      const refusal = assertThrowsError(() => support(broken));

      // Then it is refused. Ordering it would have swallowed the one and the
      // two into it and answered with a support of one outcome.
      assertInstanceOf(refusal, RangeError);
      assertStringIncludes(refusal.message, "NaN");
    });

    it("reads several absent answers as one absent answer", () => {
      // Given a mapping that finds nothing for any outcome. `undefined` is a
      // value here, and sorting moves every one of them to the end without
      // consulting the order.
      const nowhere = mapOutcomes(spread([1, 2, 3]), () => undefined);

      // When the support is read.
      // Then the three of them are the one answer, kept once.
      assertArrayEquals([...nowhere.values], [undefined]);
    });

    it("takes an order of its own", () => {
      // Given outcomes ordered by something other than their value.
      const words = spread(["ccc", "a", "bb"]);

      // When the support is read by length.
      const ordered = support(
        words,
        (left, right) => left.length - right.length,
      );

      // Then that is the order the outcomes come back in.
      assertArrayEquals([...ordered], ["a", "bb", "ccc"]);
    });
  });
});
