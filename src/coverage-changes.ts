/** Added and removed coverage between two definitions. */

import { type CoverageSource, covered } from "./assigned.js";
import type { QueryWindow } from "./context.js";
import { refuse, unknownIn } from "./horizon-guard.js";
import { difference } from "./interval-difference.js";
import type { IntervalStream } from "./interval-stream.js";

/** The times added to and removed from a definition. */
export interface CoverageChanges {
  readonly added: IntervalStream;
  readonly removed: IntervalStream;
}

/** Compares the covered time before and after a change. */
export function coverageChanges<B, A>(
  before: CoverageSource<B>,
  after: CoverageSource<A>,
  context: QueryWindow,
): CoverageChanges {
  const fog = unknownIn(before, context) ?? unknownIn(after, context);
  if (fog !== undefined) {
    refuse("coverageChanges()", fog, context);
  }
  return {
    added: difference(covered(after, context), covered(before, context)),
    removed: difference(covered(before, context), covered(after, context)),
  };
}
