/** The output formats supported by timeline rendering. */
export const TIMELINE_FORMATS = ["text", "svg"] as const;

/** A timeline output format. */
export type TimelineFormat = (typeof TIMELINE_FORMATS)[number];

/** Options for rendering covered time. */
export interface TimelineOptions {
  readonly format?: TimelineFormat;
}

/** A finite covered span in one timeline row. */
export interface TimelineSpan {
  readonly start: Temporal.ZonedDateTime;
  readonly end: Temporal.ZonedDateTime;
}

/** One local calendar day in a rendered timeline. */
export interface TimelineRow {
  readonly label: string;
  readonly start: Temporal.ZonedDateTime;
  readonly end: Temporal.ZonedDateTime;
  readonly visibleStart: Temporal.ZonedDateTime;
  readonly visibleEnd: Temporal.ZonedDateTime;
  readonly covered: readonly TimelineSpan[];
}
