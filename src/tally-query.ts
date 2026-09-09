import { requireWindowEnd } from "./context.js";
import { accumulate, type ElapsedUnit } from "./accumulate.js";
import type { Cascade } from "./cascade.js";
import type { Context } from "./context.js";
import { valueAt } from "./assigned.js";
import { explainTally } from "./explain.js";
import { duration } from "./interval.js";
import { resolve } from "./resolve.js";
import { validate } from "./semantic-validation.js";
import type { Tally } from "./tally-types.js";
import { checkWindow } from "./validation.js";
import { refuse, unknownValueIn } from "./horizon-guard.js";
import { coalesce, overlay, type ValuedStream } from "./valued-stream.js";
import type { QueryWindow } from "./context.js";

/** Query methods for numeric values over time. */
type TallyQueries = Pick<
  Tally,
  | "countAt"
  | "explain"
  | "minimumCount"
  | "totalBetween"
  | "countIntervals"
  | "validate"
>;

/**
 * Creates the query methods restored onto a tally.
 *
 * `read` is what the tally carries beside its window: the registry a `custom`
 * rule in one of its scopes is looked up in. Every query builds its own
 * window, so each spreads `read` into the context it makes.
 */
export function tallyQueries(
  document: Cascade<number>,
  read?: Omit<Context, "from" | "to">,
): TallyQueries {
  return {
    countAt: (at, options) =>
      valueAt(document, at, { ...read, ...options }) ?? 0,
    explain: (at, options) =>
      explainTally(document, at, { ...read, ...options }),
    minimumCount: (from, to, options) =>
      leastValue(document, from, to, { ...read, ...options }),
    totalBetween: (from, to, unit: ElapsedUnit, options) =>
      accumulate(document, { ...read, ...options, from, to }, unit),
    countIntervals: (from, to, options) =>
      completeCounts(document, { ...read, ...options, from, to }),
    validate: (from, to, options) =>
      validate(document, { ...read, ...options, from, to }, options),
  };
}

/** Finds the lowest tally value across a complete time window. */
export function leastValue(
  document: Cascade<number>,
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime,
  read?: Omit<Context, "from" | "to">,
): number {
  checkWindow(from, to);
  const context = { ...read, from, to };
  const fog = unknownValueIn(document, context);
  if (fog !== undefined) {
    refuse("minimumCount()", fog, context, "unknownValueIntervals()");
  }
  let lowest: number | undefined;
  let covered = Temporal.Duration.from({ seconds: 0 });
  for (const span of resolve(document, { ...read, from, to })) {
    lowest = lowest === undefined ? span.value : Math.min(lowest, span.value);
    const length = duration(span);
    if (length !== undefined) {
      covered = covered.add(length);
    }
  }
  const window = from.until(to, { largestUnit: "hour" });
  return Temporal.Duration.compare(covered, window) < 0
    ? Math.min(0, lowest ?? 0)
    : (lowest ?? 0);
}

/** Includes the tally's zero count wherever no contribution applies. */
function completeCounts(
  document: Cascade<number>,
  context: QueryWindow,
): ValuedStream<number> {
  checkWindow(context.from, context.to);
  requireWindowEnd(context, "countIntervals() needs a finite window with to.");
  const fog = unknownValueIn(document, context);
  if (fog !== undefined) {
    refuse("countIntervals()", fog, context, "unknownValueIntervals()");
  }
  if (context.from.equals(context.to)) {
    return [];
  }
  return coalesce(
    overlay(
      [{ start: context.from, end: context.to, value: 0 }],
      resolve(document, context),
      (_zero, count) => count,
    ),
  );
}
