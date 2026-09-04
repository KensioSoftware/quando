import { renderSvgRow, SVG_LAYOUT } from "./timeline-svg-row.js";
import type { TimelineRow } from "./timeline-types.js";

/** Renders local calendar days as a standalone SVG chart. */
export function renderSvgTimeline(
  rows: readonly TimelineRow[],
  from: Temporal.ZonedDateTime,
  to: Temporal.ZonedDateTime,
): string {
  const height =
    SVG_LAYOUT.top + Math.max(rows.length, 1) * SVG_LAYOUT.rowHeight + 44;
  const description = `Covered time from ${from.toString()} to ${to.toString()}.`;
  const output = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_LAYOUT.width} ${height}" role="img" aria-label="Coverage timeline" class="quando-timeline">`,
    "<title>Coverage timeline</title>",
    `<desc>${description}</desc>`,
    "<style>.quando-timeline .label,.quando-timeline .tick,.quando-timeline .detail,.quando-timeline .legend{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a}.quando-timeline .label,.quando-timeline .detail{font-size:13px}.quando-timeline .tick,.quando-timeline .legend{font-size:12px}.quando-timeline .grid{stroke:#cbd5e1;stroke-width:1}.quando-timeline .uncovered{fill:#e2e8f0}.quando-timeline .covered{fill:#2563eb}</style>",
  ];
  for (const [index, label] of [
    "00:00",
    "06:00",
    "12:00",
    "18:00",
    "24:00",
  ].entries()) {
    const tickX = SVG_LAYOUT.chartX + (index * SVG_LAYOUT.chartWidth) / 4;
    output.push(
      `<text x="${tickX}" y="24" text-anchor="middle" class="tick">${label}</text>`,
      `<line x1="${tickX}" y1="32" x2="${tickX}" y2="${SVG_LAYOUT.top + rows.length * SVG_LAYOUT.rowHeight}" class="grid"/>`,
    );
  }
  for (const [index, row] of rows.entries()) {
    output.push(...renderSvgRow(row, index));
  }
  output.push(
    `<rect x="${SVG_LAYOUT.chartX}" y="${height - 24}" width="18" height="12" rx="2" class="covered"/>`,
    `<text x="${SVG_LAYOUT.chartX + 26}" y="${height - 13}" class="legend">covered</text>`,
    `<rect x="${SVG_LAYOUT.chartX + 100}" y="${height - 24}" width="18" height="12" rx="2" class="uncovered"/>`,
    `<text x="${SVG_LAYOUT.chartX + 126}" y="${height - 13}" class="legend">uncovered</text>`,
    "</svg>",
  );
  return output.join("\n");
}
