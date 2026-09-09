import { requireWindowEnd } from "./context.js";
import type { CoverageSource } from "./assigned.js";
import type { QueryWindow } from "./context.js";
import { evaluationOptions } from "./evaluation-options.js";
import { refuse, unknownIn } from "./horizon-guard.js";
import { timelineData } from "./timeline-data.js";
import { renderTextTimeline } from "./timeline-text.js";
import type { Timeline } from "./timeline-types.js";
import { checkWindow } from "./validation.js";

export {
  TIMELINE_FORMATS,
  type Timeline,
  type TimelineDay,
  type TimelineFormat,
  type TimelineSpan,
} from "./timeline-types.js";

/** Evaluates covered time as JSON-compatible data over a finite window. */
export function timeline<V>(
  source: CoverageSource<V>,
  context: QueryWindow,
): Timeline {
  checkWindow(context.from, context.to);
  requireWindowEnd(context, "timeline() needs a finite window with to.");
  const read = evaluationOptions(source, {
    ...context,
    to: context.to.withTimeZone(context.from.timeZoneId),
  });
  const fog = unknownIn(source, read);
  if (fog !== undefined) {
    refuse("timeline()", fog, read);
  }
  return timelineData(source, read);
}

/** Renders evaluated timeline data as text without evaluating rules again. */
export function renderTimeline(data: Timeline): string {
  return renderTextTimeline(data);
}
