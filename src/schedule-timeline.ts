import type { Cascade } from "./cascade.js";
import type { EvaluationOptions } from "./context.js";
import { timeline, type Timeline } from "./timeline.js";

/** Evaluates a schedule in its declared zone or the query's zone. */
export function scheduleTimeline(
  document: Cascade<boolean>,
  zone: string | undefined,
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime,
  options?: EvaluationOptions,
): Timeline {
  const inZone = zone ?? from.timeZoneId;
  return timeline(document, {
    ...options,
    from: from.withTimeZone(inZone),
    to: to.withTimeZone(inZone),
  });
}
