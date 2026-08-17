import { faker } from "@faker-js/faker";
import {
  assertArrayLength,
  assertInstanceOf,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { take } from "./stream.js";

describe("take", () => {
  /** Endless. A `take` that fails to stop never returns. */
  function* naturals(): Iterable<number> {
    for (let n = 0; ; n++) {
      yield n;
    }
  }

  it("stops after the count asked for, however long the source", () => {
    // Given a source with no end to reach.
    const source = naturals();

    // When some number of items is asked for.
    const count = faker.number.int({ min: 1, max: 20 });
    const taken = take(source, count);

    // Then that many arrive and the pull stops there.
    assertArrayLength(taken, count);
  });

  it("takes nothing for zero or a negative count", () => {
    // Given the same endless source.
    // When a count of zero or below is asked for.
    // Then nothing is pulled at all.
    assertArrayLength(take(naturals(), 0), 0);
    assertArrayLength(take(naturals(), faker.number.int({ min: -20, max: -1 })), 0);
  });

  it("refuses a count that is not a whole number", () => {
    // Given counts that fail every comparison which would end the loop.
    // Without this guard they hang on an endless source.
    const impossible = [Number.NaN, Number.POSITIVE_INFINITY, 2.5];

    for (const count of impossible) {
      // When one of them is asked for.
      const error = assertThrowsError(() => take(naturals(), count));

      // Then it is refused before anything is pulled.
      assertInstanceOf(error, RangeError);
    }
  });
});
