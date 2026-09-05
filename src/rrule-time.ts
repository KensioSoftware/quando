/**
 * The time of day a recurrence runs at.
 *
 * `BYHOUR` and `BYMINUTE` name it when they are there, and DTSTART's own clock
 * time fills in whichever is missing. A start with no time and neither part
 * means the recurrence covers whole days, which is what an all-day event is.
 */

import { coveredMinutes, timeOfDayRule } from "./minute-windows.js";
import type { Rule } from "./rule.js";
import { partNumbers } from "./rrule-values.js";

export function timeRule(
  parts: Map<string, string>,
  time: Temporal.PlainTime | undefined,
): Rule | undefined {
  const byHour = partNumbers(parts, "BYHOUR", 0, 23);
  const byMinute = partNumbers(parts, "BYMINUTE", 0, 59);

  if (byHour === undefined && byMinute === undefined && time === undefined) {
    return undefined;
  }

  return timeOfDayRule(
    coveredMinutes(
      byHour ?? [time?.hour ?? 0],
      byMinute ?? [time?.minute ?? 0],
    ),
  );
}
