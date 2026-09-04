import {
  MINUTES_PER_DAY,
  timelineMinute,
  timelineTime,
} from "./timeline-position.js";
import type { TimelineRow } from "./timeline-types.js";

export const SVG_LAYOUT = {
  width: 1200,
  chartX: 140,
  chartWidth: 720,
  top: 54,
  rowHeight: 32,
} as const;

function x(at: Temporal.ZonedDateTime, row: TimelineRow): number {
  return (
    SVG_LAYOUT.chartX +
    (timelineMinute(at, row) / MINUTES_PER_DAY) * SVG_LAYOUT.chartWidth
  );
}

function number(value: number): string {
  return value.toFixed(2).replace(/\.00$/u, "");
}

function details(row: TimelineRow): string {
  const spans = row.covered.map(
    (span) => `${timelineTime(span.start, row)}-${timelineTime(span.end, row)}`,
  );
  return spans.length === 0 ? "none" : spans.join(", ");
}

/** Draws one SVG day row and its exact interval labels. */
export function renderSvgRow(
  row: TimelineRow,
  index: number,
): readonly string[] {
  const y = SVG_LAYOUT.top + index * SVG_LAYOUT.rowHeight;
  const trackStart = x(row.visibleStart, row);
  const trackEnd = x(row.visibleEnd, row);
  return [
    `<text x="0" y="${y + 15}" class="label">${row.label}</text>`,
    `<rect x="${number(trackStart)}" y="${y}" width="${number(trackEnd - trackStart)}" height="20" rx="2" class="uncovered"/>`,
    ...row.covered.map((span) => {
      const start = x(span.start, row);
      return `<rect x="${number(start)}" y="${y}" width="${number(x(span.end, row) - start)}" height="20" rx="2" class="covered"/>`;
    }),
    `<text x="875" y="${y + 15}" class="detail">${details(row)}</text>`,
  ];
}
