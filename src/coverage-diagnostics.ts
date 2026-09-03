/** Diagnostics for uncovered time inside a validation window. */

import type { Cascade } from "./cascade.js";
import { windowOf } from "./context.js";
import { difference } from "./interval-difference.js";
import type { IntervalStream } from "./interval-stream.js";
import { resolve } from "./resolve.js";
import type {
  ValidationDiagnostic,
  ValidationWindow,
} from "./semantic-validation.js";

/** Finds intervals where a cascade assigns no value. */
export function coverageDiagnostics(
  cascade: Cascade<unknown>,
  window: ValidationWindow,
): readonly ValidationDiagnostic[] {
  const uncovered = difference(
    [windowOf(window)],
    assignedTime(cascade, window),
  );
  return [...uncovered].map((interval) => ({
    code: "uncovered-time" as const,
    interval,
    message: "No value is assigned during this interval.",
  }));
}

function* assignedTime(
  cascade: Cascade<unknown>,
  window: ValidationWindow,
): IntervalStream {
  for (const { start, end } of resolve(cascade, window)) {
    yield { start, end };
  }
}
