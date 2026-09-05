import { assertIdentical } from "@kensio/smartass";
import {
  assertNormalized,
  endpoints,
  includesPoint,
  intervalSet,
} from "#test/property-intervals.js";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { difference } from "./interval-difference.js";
import { complement, intersect, union } from "./interval-stream.js";

describe("interval algebra laws", () => {
  for (const operation of [union, intersect]) {
    it(`${operation.name} is commutative, associative and idempotent`, () => {
      // Given three independently generated, normalized interval sets.
      const law = fc.property(
        intervalSet,
        intervalSet,
        intervalSet,
        (a, b, c) => {
          // When operands are reordered, regrouped or repeated.
          const ab = [...operation(a, b)];
          const bc = [...operation(b, c)];
          // Then each algebraic identity preserves the complete interval set.
          expect(endpoints(ab)).toStrictEqual(endpoints(operation(b, a)));
          expect(endpoints(operation(ab, c))).toStrictEqual(
            endpoints(operation(a, bc)),
          );
          expect(endpoints(operation(a, a))).toStrictEqual(endpoints(a));
        },
      );
      fc.assert(law, { numRuns: 500 });
    });
  }

  it("obeys both De Morgan laws and double complementation", () => {
    // Given bounded sets whose complements have unbounded outer ends.
    const law = fc.property(intervalSet, intervalSet, (a, b) => {
      // When complement is distributed over each binary operation.
      const notA = [...complement(a)];
      const notB = [...complement(b)];
      const joined = union(a, b);
      const common = intersect(a, b);
      // Then exchanging union and intersection gives the same intervals.
      expect(endpoints(complement(joined))).toStrictEqual(
        endpoints(intersect(notA, notB)),
      );
      expect(endpoints(complement(common))).toStrictEqual(
        endpoints(union(notA, notB)),
      );
      expect(endpoints(complement(notA))).toStrictEqual(endpoints(a));
    });
    fc.assert(law, { numRuns: 500 });
  });

  it("matches point membership and keeps every output normalized", () => {
    // Given endpoints on a small integer nanosecond grid, including touching boundaries.
    const law = fc.property(intervalSet, intervalSet, (a, b) => {
      // When each set operation evaluates those inputs.
      const outputs = [
        [...union(a, b)],
        [...intersect(a, b)],
        [...difference(a, b)],
        [...complement(a)],
      ];
      // Then every boundary and elementary span agrees with a direct membership oracle.
      for (const output of outputs) {
        assertNormalized(output);
      }
      for (let offset = -33; offset <= 33; offset += 1) {
        const at = BigInt(offset);
        const left = includesPoint(a, at);
        const right = includesPoint(b, at);
        const expected = [left || right, left && right, left && !right, !left];
        for (const [index, output] of outputs.entries()) {
          assertIdentical(includesPoint(output, at), expected[index]);
        }
      }
    });
    fc.assert(law, { numRuns: 500 });
  });
});
