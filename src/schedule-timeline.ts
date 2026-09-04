import type { Cascade } from "./cascade.js";
import {
  renderTimeline,
  type TimelineFormat,
  type TimelineOptions,
  type TimelineOutput,
} from "./timeline.js";

/** Renders a schedule in its declared zone, or in the caller's zone. */
export function renderScheduleTimeline<F extends TimelineFormat = "json">(
  document: Cascade<boolean>,
  zone: string | undefined,
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime,
  options?: TimelineOptions & { readonly format?: F },
): TimelineOutput<F> {
  const inZone = zone ?? from.timeZoneId;
  return renderTimeline(
    document,
    { from: from.withTimeZone(inZone), to: to.withTimeZone(inZone) },
    options,
  );
}
