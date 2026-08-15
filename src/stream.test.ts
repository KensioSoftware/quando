import {
  assertArrayLength,
  assertInstanceOf,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { take } from "./stream.js";

/** Deliberately endless, so a `take` that fails to stop never returns. */
function* naturals(): Iterable<number> {
  for (let n = 0; ; n++) {
    yield n;
  }
}

describe("take", () => {
  it("stops after the count asked for, however long the source", () => {
    assertArrayLength(take(naturals(), 3), 3);
  });

  it("takes nothing for zero or a negative count", () => {
    assertArrayLength(take(naturals(), 0), 0);
    assertArrayLength(take(naturals(), -1), 0);
  });

  it("refuses a count that is not a whole number", () => {
    // Each of these fails every comparison that would end the loop, so without
    // the guard they hang on an endless source instead of returning anything.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 2.5]) {
      const error = assertThrowsError(() => take(naturals(), bad));
      assertInstanceOf(error, RangeError);
    }
  });
});
