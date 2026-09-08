/**
 * How many occurrences a cap counts at one instant.
 *
 * The evaluator works from the occurrences out to the stretches they rule out.
 * An explanation asks it pointing the other way, and by then the stream of
 * intervals has forgotten how many things made it. So the count is taken here,
 * from the history itself.
 *
 * The bucket comes from [occurrence-buckets.ts](./occurrence-buckets.ts), the
 * same function the evaluator uses. A second answer to "which day is this in"
 * would eventually disagree with the first, and the explanation would then be
 * describing a rule nobody was evaluating.
 */

import type { Context } from "./context.js";
import type { Occurrence } from "./occurrence.js";
import { bucketAround } from "./occurrence-buckets.js";
import type { AtMostRule } from "./rule.js";

/**
 * How many occurrences the cap counts at this instant.
 *
 * The rolling window is the one ending here. The calendar bucket is the one
 * holding this instant, counted whole, because a full day is full whichever
 * end of it is being asked about.
 */
export function countedFor(
  rule: AtMostRule,
  at: Temporal.ZonedDateTime,
  history: readonly Occurrence[],
  read: Omit<Context, "from" | "to"> | undefined,
): number {
  // The ends move back a nanosecond, because a bucket is half-open at its
  // start and the comparison below is closed at both. An occurrence at
  // midnight belongs to the day that midnight opens.
  const bucket =
    rule.within === undefined
      ? bucketAround(at, rule.per, rule.zone ?? at.timeZoneId, read)
      : undefined;
  const [opened, closed] =
    bucket === undefined
      ? [at.subtract(Temporal.Duration.from(rule.within ?? "")), at]
      : [
          bucket.start.subtract({ nanoseconds: 1 }),
          bucket.end.subtract({ nanoseconds: 1 }),
        ];

  return history.filter(
    (one) =>
      Temporal.ZonedDateTime.compare(one.at, opened) > 0 &&
      Temporal.ZonedDateTime.compare(one.at, closed) <= 0,
  ).length;
}
