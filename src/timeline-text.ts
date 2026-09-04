import {
  MINUTES_PER_DAY,
  timelineMinute,
  timelineTime,
} from "./timeline-position.js";
import { type TextTimelineDay, textTimelineDay } from "./timeline-text-day.js";
import type { Timeline } from "./timeline-types.js";

const COLUMNS = 48;

function overlaps(
  start: number,
  end: number,
  intervalStart: number,
  intervalEnd: number,
): number {
  return Math.max(
    0,
    Math.min(end, intervalEnd) - Math.max(start, intervalStart),
  );
}

function cell(day: TextTimelineDay, column: number): string {
  const start = (column * MINUTES_PER_DAY) / COLUMNS;
  const end = ((column + 1) * MINUTES_PER_DAY) / COLUMNS;
  const visible = overlaps(
    start,
    end,
    timelineMinute(day.visibleStart, day),
    timelineMinute(day.visibleEnd, day),
  );
  if (visible === 0) {
    return " ";
  }
  const amount = day.covered.reduce(
    (total, span) =>
      total +
      overlaps(
        start,
        end,
        timelineMinute(span.start, day),
        timelineMinute(span.end, day),
      ),
    0,
  );
  if (amount === 0) {
    return ".";
  }
  return amount >= visible ? "#" : "+";
}

function details(day: TextTimelineDay): string {
  const spans = day.covered.map(
    (span) => `${timelineTime(span.start, day)}-${timelineTime(span.end, day)}`,
  );
  return spans.length === 0 ? "none" : spans.join(", ");
}

function axis(): string {
  const characters = Array.from({ length: COLUMNS + 5 }, () => " ");
  for (const [offset, text] of [
    [0, "00:00"],
    [12, "06:00"],
    [24, "12:00"],
    [36, "18:00"],
    [48, "24:00"],
  ] as const) {
    characters.splice(offset, text.length, ...text.split(""));
  }
  return characters.join("").trimEnd();
}

/** Renders local calendar days as a fixed-width text chart. */
export function renderTextTimeline(timeline: Timeline): string {
  const days = timeline.days.map(textTimelineDay);
  if (days.length === 0) {
    return "No time in the requested window.";
  }
  const labelWidth = Math.max(...days.map((day) => day.label.length));
  const lines = [
    `Time zone: ${timeline.zone}`,
    axis().padStart(labelWidth + 2 + axis().length),
  ];
  for (const day of days) {
    const cells = Array.from({ length: COLUMNS }, (_, column) =>
      cell(day, column),
    ).join("");
    lines.push(`${day.label.padEnd(labelWidth)} |${cells}| ${details(day)}`);
  }
  lines.push("# covered  + partly covered  . uncovered");
  return lines.join("\n");
}
