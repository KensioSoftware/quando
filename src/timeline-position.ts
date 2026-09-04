import type { TimelineRow } from "./timeline-types.js";

export const MINUTES_PER_DAY = 24 * 60;

/** The wall-clock position of an instant in its timeline row. */
export function timelineMinute(
  at: Temporal.ZonedDateTime,
  row: TimelineRow,
): number {
  if (Temporal.ZonedDateTime.compare(at, row.end) === 0) {
    return MINUTES_PER_DAY;
  }
  return (
    at.hour * 60 +
    at.minute +
    at.second / 60 +
    at.millisecond / 60_000 +
    at.microsecond / 60_000_000 +
    at.nanosecond / 60_000_000_000
  );
}

/** The exact wall-clock label for an interval endpoint. */
export function timelineTime(
  at: Temporal.ZonedDateTime,
  row: TimelineRow,
): string {
  if (Temporal.ZonedDateTime.compare(at, row.end) === 0) {
    return "24:00";
  }
  if (
    at.second === 0 &&
    at.millisecond === 0 &&
    at.microsecond === 0 &&
    at.nanosecond === 0
  ) {
    return at.toPlainTime().toString({ smallestUnit: "minute" });
  }
  return at.toPlainTime().toString();
}
