/**
 * Whether a rule covers an instant, and whether that answer is known.
 *
 * What an explanation reads. A query refuses where this says `unknown`, and an
 * explanation reports it, because the job of an explanation is to say what the
 * state is rather than to act on it.
 */

import { covered, type Covers } from "./assigned.js";
import type { Context } from "./context.js";
import { unknownIn } from "./horizon-guard.js";
import { take } from "./stream.js";

/** Whether a rule certainly covers an instant, or is not known to. */
export type Certainty = "covered" | "uncovered" | "unknown";

/**
 * Whether a rule covers an instant, and whether that answer is known.
 *
 * What an explanation reads. A query refuses where this says `unknown`, and an
 * explanation reports it, because the job of an explanation is to say what the
 * state is rather than to act on it.
 */
export function certaintyAt<V>(
  covers: Covers<V>,
  at: Temporal.ZonedDateTime,
  context: Omit<Context, "from" | "to"> | undefined,
): Certainty {
  const moment: Context = {
    ...context,
    from: at,
    to: at.add({ nanoseconds: 1 }),
  };
  if (take(covered(covers, moment), 1).length > 0) {
    return "covered";
  }
  return unknownIn(covers, moment) === undefined ? "uncovered" : "unknown";
}
