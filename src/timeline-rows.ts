import { type Covers, covered } from "./assigned.js";
import type { Context } from "./context.js";
import type { Interval } from "./interval.js";
import type { TimelineRow, TimelineSpan } from "./timeline-types.js";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
    ? overlap
    : undefined;
}

function label(date: Temporal.PlainDate): string {
  return `${DAY_LABELS[date.dayOfWeek - 1]} ${date.toString()}`;
}

/** Splits finite covered time into local calendar-day rows. */
export function timelineRows<V>(
  source: Covers<V>,
  context: Context & { readonly to: Temporal.ZonedDateTime },
): readonly TimelineRow[] {
  const to = context.to;
  const spans = [...covered(source, context)];
  const rows: TimelineRow[] = [];
  if (Temporal.ZonedDateTime.compare(context.from, to) === 0) {
    return rows;
  }
  let date = context.from.toPlainDate();

  for (;;) {
    const start = startOfDay(date, context);
    if (Temporal.ZonedDateTime.compare(start, to) >= 0) {
      return rows;
    }
    const end = startOfDay(date.add({ days: 1 }), context);
    const visibleStart = later(start, context.from);
    const visibleEnd = earlier(end, to);
    const rowSpans = spans
      .map((span) => clipped(span, visibleStart, visibleEnd))
      .filter((span) => span !== undefined);
    rows.push({
      label: label(date),
      start,
      end,
      visibleStart,
      visibleEnd,
      covered: rowSpans,
    });
    date = date.add({ days: 1 });
  }
}
