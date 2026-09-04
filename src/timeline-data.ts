import { type Covers, covered } from "./assigned.js";
import type { Context } from "./context.js";
import type { Interval } from "./interval.js";
import type { Timeline, TimelineDay, TimelineSpan } from "./timeline-types.js";

function startOfDay(
  date: Temporal.PlainDate,
  context: Context,
): Temporal.ZonedDateTime {
  return date
    .toPlainDateTime("00:00")
    .toZonedDateTime(context.from.timeZoneId, {
      disambiguation: context.disambiguation ?? "compatible",
    });
}

function later(
  left: Temporal.ZonedDateTime,
  right: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.compare(left, right) >= 0 ? left : right;
}

function earlier(
  left: Temporal.ZonedDateTime,
  right: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.compare(left, right) <= 0 ? left : right;
}

function clipped(
  interval: Interval,
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
): TimelineSpan | undefined {
  const intervalStart = interval.start;
  const intervalEnd = interval.end;
  if (intervalStart === undefined || intervalEnd === undefined) {
    return;
  }
  const overlap = {
    start: later(intervalStart, start),
    end: earlier(intervalEnd, end),
  };
  return Temporal.ZonedDateTime.compare(overlap.start, overlap.end) < 0
    ? { start: overlap.start.toString(), end: overlap.end.toString() }
    : undefined;
}

function timelineDays<V>(
  source: Covers<V>,
  context: Context & { readonly to: Temporal.ZonedDateTime },
): readonly TimelineDay[] {
  const to = context.to;
  const spans = [...covered(source, context)];
  const days: TimelineDay[] = [];
  if (Temporal.ZonedDateTime.compare(context.from, to) === 0) {
    return days;
  }
  let date = context.from.toPlainDate();

  for (;;) {
    const start = startOfDay(date, context);
    if (Temporal.ZonedDateTime.compare(start, to) >= 0) {
      return days;
    }
    const end = startOfDay(date.add({ days: 1 }), context);
    const visibleStart = later(start, context.from);
    const visibleEnd = earlier(end, to);
    const daySpans = spans
      .map((span) => clipped(span, visibleStart, visibleEnd))
      .filter((span) => span !== undefined);
    days.push({
      date: date.toString(),
      start: start.toString(),
      end: end.toString(),
      visibleStart: visibleStart.toString(),
      visibleEnd: visibleEnd.toString(),
      covered: daySpans,
    });
    date = date.add({ days: 1 });
  }
}

/** Returns JSON-compatible coverage data for a finite window. */
export function timelineData<V>(
  source: Covers<V>,
  context: Context & { readonly to: Temporal.ZonedDateTime },
): Timeline {
  return {
    type: "timeline",
    zone: context.from.timeZoneId,
    from: context.from.toString(),
    to: context.to.toString(),
    days: timelineDays(source, context),
  };
}
