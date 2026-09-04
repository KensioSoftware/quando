import type { TimelineDay } from "./timeline-types.js";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface TextTimelineSpan {
  readonly start: Temporal.ZonedDateTime;
  readonly end: Temporal.ZonedDateTime;
}

export interface TextTimelineDay {
  readonly label: string;
  readonly start: Temporal.ZonedDateTime;
  readonly end: Temporal.ZonedDateTime;
  readonly visibleStart: Temporal.ZonedDateTime;
  readonly visibleEnd: Temporal.ZonedDateTime;
  readonly covered: readonly TextTimelineSpan[];
}

/** Converts one JSON timeline day into values used by the text layout. */
export function textTimelineDay(day: TimelineDay): TextTimelineDay {
  const date = Temporal.PlainDate.from(day.date);
  return {
    label: `${DAY_LABELS[date.dayOfWeek - 1]} ${day.date}`,
    start: Temporal.ZonedDateTime.from(day.start),
    end: Temporal.ZonedDateTime.from(day.end),
    visibleStart: Temporal.ZonedDateTime.from(day.visibleStart),
    visibleEnd: Temporal.ZonedDateTime.from(day.visibleEnd),
    covered: day.covered.map(({ start, end }) => ({
      start: Temporal.ZonedDateTime.from(start),
      end: Temporal.ZonedDateTime.from(end),
    })),
  };
}
