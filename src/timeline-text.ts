import {
  MINUTES_PER_DAY,
  timelineMinute,
  timelineTime,
} from "./timeline-position.js";
import type { TimelineRow } from "./timeline-types.js";

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

function cell(row: TimelineRow, column: number): string {
  const start = (column * MINUTES_PER_DAY) / COLUMNS;
  const end = ((column + 1) * MINUTES_PER_DAY) / COLUMNS;
  const visible = overlaps(
    start,
    end,
    timelineMinute(row.visibleStart, row),
    timelineMinute(row.visibleEnd, row),
  );
  if (visible === 0) {
    return " ";
  }
  const amount = row.covered.reduce(
    (total, span) =>
      total +
      overlaps(
        start,
        end,
        timelineMinute(span.start, row),
        timelineMinute(span.end, row),
      ),
    0,
  );
  if (amount === 0) {
    return ".";
  }
  return amount >= visible ? "#" : "+";
}

function details(row: TimelineRow): string {
  const spans = row.covered.map(
    (span) => `${timelineTime(span.start, row)}-${timelineTime(span.end, row)}`,
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
export function renderTextTimeline(
  rows: readonly TimelineRow[],
  zone: string,
): string {
  if (rows.length === 0) {
    return "No time in the requested window.";
  }
  const labelWidth = Math.max(...rows.map((row) => row.label.length));
  const lines = [
    `Time zone: ${zone}`,
    axis().padStart(labelWidth + 2 + axis().length),
  ];
  for (const row of rows) {
    const cells = Array.from({ length: COLUMNS }, (_, column) =>
      cell(row, column),
    ).join("");
    lines.push(`${row.label.padEnd(labelWidth)} |${cells}| ${details(row)}`);
  }
  lines.push("# covered  + partly covered  . uncovered");
  return lines.join("\n");
}
