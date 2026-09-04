/** JSON data and text charts of covered time. */

import type { Covers } from "./assigned.js";
import type { Context } from "./context.js";
import { timelineData } from "./timeline-data.js";
import { renderTextTimeline } from "./timeline-text.js";
import {
  TIMELINE_FORMATS,
  type TimelineFormat,
  type TimelineOptions,
  type TimelineOutput,
} from "./timeline-types.js";

export {
  TIMELINE_FORMATS,
  type Timeline,
  type TimelineDay,
  type TimelineFormat,
  type TimelineOptions,
  type TimelineOutput,
  type TimelineSpan,
} from "./timeline-types.js";

/**
 * Returns the time covered inside a finite window.
 *
 * JSON-compatible data is the default. Text output is derived from that data.
 */
export function renderTimeline<V, F extends TimelineFormat = "json">(
  source: Covers<V>,
  context: Context,
  options?: TimelineOptions & { readonly format?: F },
): TimelineOutput<F> {
  const contextTo = context.to;
  if (contextTo === undefined) {
    throw new RangeError(
      "renderTimeline() needs a window with an end. Give the context a `to`.",
    );
  }
  const to = contextTo.withTimeZone(context.from.timeZoneId);
  const format = options?.format ?? "json";
  if (!(TIMELINE_FORMATS as readonly string[]).includes(format)) {
    throw new RangeError(
      `renderTimeline() expected a format of ${TIMELINE_FORMATS.join(
        " or ",
      )}, but found "${format}".`,
    );
  }
  const finiteContext = { ...context, to };
  const timeline = timelineData(source, finiteContext);
  const output = format === "text" ? renderTextTimeline(timeline) : timeline;
  return output as TimelineOutput<F>;
}
