export const MINUTES_PER_DAY = 24 * 60;

export interface PositionedTimelineDay {
  readonly start: Temporal.ZonedDateTime;
  readonly end: Temporal.ZonedDateTime;
}

/** The wall-clock position of an instant in its timeline row. */
export function timelineMinute(
  at: Temporal.ZonedDateTime,
  day: PositionedTimelineDay,
): number {
  if (Temporal.ZonedDateTime.compare(at, day.end) === 0) {
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
  day: PositionedTimelineDay,
): string {
  if (Temporal.ZonedDateTime.compare(at, day.end) === 0) {
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
