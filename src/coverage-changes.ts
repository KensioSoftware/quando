/** Added and removed coverage between two definitions. */

import { type Covers, covered } from "./assigned.js";
import type { Context } from "./context.js";
import { difference } from "./interval-difference.js";
import type { IntervalStream } from "./interval-stream.js";

/** The times added to and removed from a definition. */
export interface CoverageChanges {
  readonly added: IntervalStream;
  readonly removed: IntervalStream;
}

/** Compares the covered time before and after a change. */
export function coverageChanges<B, A>(
  before: Covers<B>,
  after: Covers<A>,
  context: Context,
): CoverageChanges {
  return {
    added: difference(covered(after, context), covered(before, context)),
    removed: difference(covered(before, context), covered(after, context)),
  };
}
