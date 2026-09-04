/** The output formats supported by timeline rendering. */
export const TIMELINE_FORMATS = ["json", "text"] as const;

/** A timeline output format. */
export type TimelineFormat = (typeof TIMELINE_FORMATS)[number];

/** Options for rendering covered time. */
export interface TimelineOptions {
  readonly format?: TimelineFormat;
}

/** A finite covered span in timeline data. */
export interface TimelineSpan {
  readonly start: string;
  readonly end: string;
}

/** One local calendar day in timeline data. */
export interface TimelineDay {
  readonly date: string;
  readonly start: string;
  readonly end: string;
  readonly visibleStart: string;
  readonly visibleEnd: string;
  readonly covered: readonly TimelineSpan[];
}

/** JSON-compatible coverage data for a finite window. */
export interface Timeline {
  readonly type: "timeline";
  readonly zone: string;
  readonly from: string;
  readonly to: string;
  readonly days: readonly TimelineDay[];
}

/** The result returned for a requested timeline format. */
export type TimelineOutput<F extends TimelineFormat> = F extends "text"
  ? string
  : Timeline;
