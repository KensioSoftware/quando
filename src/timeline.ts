/** Human-readable charts of covered time. */

import type { Covers } from "./assigned.js";
import type { Context } from "./context.js";
import { renderSvgTimeline } from "./timeline-svg.js";
import { renderTextTimeline } from "./timeline-text.js";
import { TIMELINE_FORMATS, type TimelineOptions } from "./timeline-types.js";
import { timelineRows } from "./timeline-rows.js";

export {
  TIMELINE_FORMATS,
  type TimelineFormat,
  type TimelineOptions,
} from "./timeline-types.js";

/**
 * Draws the time covered inside a finite window.
 *
 * Text is the default for logs, terminals, and test output. SVG produces a
 * standalone image with the same day rows and exact interval labels.
 */
export function renderTimeline<V>(
  source: Covers<V>,
  context: Context,
  options: TimelineOptions = {},
): string {
  const contextTo = context.to;
  if (contextTo === undefined) {
    throw new RangeError(
      "renderTimeline() needs a window with an end: give the context a `to`.",
    );
  }
  const to = contextTo.withTimeZone(context.from.timeZoneId);
  const format = options.format ?? "text";
  if (!(TIMELINE_FORMATS as readonly string[]).includes(format)) {
    throw new RangeError(
      `renderTimeline() expected a format of ${TIMELINE_FORMATS.join(
        " or ",
      )}, but found "${format}".`,
    );
  }
  const finiteContext = { ...context, to };
  const rows = timelineRows(source, finiteContext);
  if (format === "svg") {
    return renderSvgTimeline(rows, context.from, to);
  }
  return renderTextTimeline(rows, context.from.timeZoneId);
}
