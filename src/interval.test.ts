import { span, when } from "#test/intervals.js";
import {
  assertFalse,
  assertIdentical,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  compareEnds,
  compareStarts,
  contains,
  duration,
  earlierEnd,
  earlierStart,
  isEmpty,
  laterEnd,
  laterStart,
  startsAtOrBeforeEnd,
  startsBeforeEnd,
} from "./interval.js";

const NINE = when("2026-03-16T09:00");
const NOON = when("2026-03-16T12:00");
const FIVE = when("2026-03-16T17:00");

describe("comparing starts", () => {
  it("treats an absent start as the unbounded past", () => {
    assertTrue(compareStarts(undefined, NINE) < 0);
    assertTrue(compareStarts(NINE, undefined) > 0);
  });

  it("considers two unbounded pasts equal", () => {
    assertIdentical(compareStarts(undefined, undefined), 0);
  });

  it("orders two bounded starts by their instants", () => {
    assertTrue(compareStarts(NINE, NOON) < 0);
    assertIdentical(compareStarts(NINE, NINE), 0);
  });
});

describe("comparing ends", () => {
  it("treats an absent end as the unbounded future", () => {
    assertTrue(compareEnds(undefined, FIVE) > 0);
    assertTrue(compareEnds(FIVE, undefined) < 0);
  });

  it("considers two unbounded futures equal", () => {
    assertIdentical(compareEnds(undefined, undefined), 0);
  });

  it("orders two bounded ends by their instants", () => {
    assertTrue(compareEnds(NOON, FIVE) < 0);
  });
});

describe("picking between two edges", () => {
  it("picks the earlier and later start, unbounded winning as the earlier", () => {
    assertIdentical(earlierStart(NINE, NOON), NINE);
    assertIdentical(earlierStart(NOON, NINE), NINE);
    assertUndefined(earlierStart(undefined, NINE));
    assertIdentical(laterStart(NINE, NOON), NOON);
    assertIdentical(laterStart(undefined, NINE), NINE);
  });

  it("picks the earlier and later end, unbounded winning as the later", () => {
    assertIdentical(earlierEnd(NOON, FIVE), NOON);
    assertIdentical(earlierEnd(FIVE, NOON), NOON);
    assertIdentical(laterEnd(FIVE, NOON), FIVE);
    assertIdentical(earlierEnd(undefined, FIVE), FIVE);
    assertIdentical(laterEnd(NOON, FIVE), FIVE);
    assertUndefined(laterEnd(undefined, FIVE));
  });
});

describe("whether a start precedes an end", () => {
  it("is true for an ordinary non-empty interval", () => {
    assertTrue(startsBeforeEnd(NINE, FIVE));
  });

  it("is false when the two coincide, because intervals are half open", () => {
    assertFalse(startsBeforeEnd(NINE, NINE));
  });

  it("is false when the start follows the end", () => {
    assertFalse(startsBeforeEnd(FIVE, NINE));
  });

  it("is true whenever either edge is unbounded", () => {
    assertTrue(startsBeforeEnd(undefined, NINE));
    assertTrue(startsBeforeEnd(FIVE, undefined));
    assertTrue(startsBeforeEnd(undefined, undefined));
  });

  it("separates touching from overlapping", () => {
    assertFalse(startsBeforeEnd(NOON, NOON));
    assertTrue(startsAtOrBeforeEnd(NOON, NOON));
    assertTrue(startsAtOrBeforeEnd(undefined, NOON));
    assertTrue(startsAtOrBeforeEnd(NOON, undefined));
  });
});

describe("emptiness", () => {
  it("is empty when the edges coincide", () => {
    assertTrue(isEmpty(span("2026-03-16T09:00", "2026-03-16T09:00")));
  });

  it("is not empty for an ordinary interval", () => {
    assertFalse(isEmpty(span("2026-03-16T09:00", "2026-03-16T17:00")));
  });

  it("is not empty when unbounded in either direction", () => {
    assertFalse(isEmpty(span(undefined, "2026-03-16T09:00")));
    assertFalse(isEmpty(span("2026-03-16T09:00", undefined)));
  });
});

describe("containment", () => {
  const workday = span("2026-03-16T09:00", "2026-03-16T17:00");

  it("includes the start", () => {
    assertTrue(contains(workday, NINE));
  });

  it("excludes the end, so adjacent intervals do not both claim it", () => {
    assertFalse(contains(workday, FIVE));
  });

  it("includes an instant in the middle", () => {
    assertTrue(contains(workday, NOON));
  });

  it("excludes an instant outside", () => {
    assertFalse(contains(workday, when("2026-03-16T08:59")));
  });

  it("contains everything when unbounded both ways", () => {
    assertTrue(contains(span(undefined, undefined), NOON));
  });
});

describe("duration", () => {
  it("measures an ordinary interval", () => {
    assertIdentical(
      duration(span("2026-03-16T09:00", "2026-03-16T17:00"))?.toString(),
      "PT8H",
    );
  });

  it("measures exact elapsed time across a spring-forward transition", () => {
    // 01:00 becomes 02:00 that morning, so six hours on the clock is five real.
    assertIdentical(
      duration(span("2026-03-29T00:00", "2026-03-29T06:00"))?.toString(),
      "PT5H",
    );
  });

  it("has no length when unbounded", () => {
    assertUndefined(duration(span(undefined, "2026-03-16T17:00")));
    assertUndefined(duration(span("2026-03-16T09:00", undefined)));
  });
});
