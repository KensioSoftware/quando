/**
 * The time of day a recurrence runs at.
 *
 * `BYHOUR` and `BYMINUTE` name it when they are there, and DTSTART's own clock
 * time fills in whichever is missing. A start with no time and neither part
 * means the recurrence covers whole days, which is what an all-day event is.
 */

import { coveredMinutes, timeOfDayRule } from "./minute-windows.js";
import type { RuleData } from "./rule.js";
import { partNumbers } from "./rrule-values.js";
import { any, always, timeOfDayRange } from "./build.js";
import { asDuration, type DurationInput } from "./duration-input.js";
import { fail } from "./parse-shape.js";

export function timeRule(
  parts: Map<string, string>,
  time: Temporal.PlainTime | undefined,
  duration?: DurationInput,
): RuleData | undefined {
  const byHour = partNumbers(parts, "BYHOUR", 0, 23);
  const byMinute = partNumbers(parts, "BYMINUTE", 0, 59);
  if (
    time !== undefined &&
    (time.second !== 0 ||
      time.millisecond !== 0 ||
      time.microsecond !== 0 ||
      time.nanosecond !== 0)
  ) {
    return fail("start", "recurrence starts must have whole-minute precision");
  }

  if (
    byHour === undefined &&
    byMinute === undefined &&
    time === undefined &&
    duration === undefined
  ) {
    return undefined;
  }

  if (duration !== undefined) {
    const amount = asDuration(duration);
    if (
      amount.years !== 0 ||
      amount.months !== 0 ||
      amount.weeks !== 0 ||
      amount.sign <= 0
    ) {
      return fail(
        "duration",
        "expected a positive wall-clock duration of at most one day",
      );
    }
    const hours = amount.total({ unit: "hours" });
    if (hours > 24) {
      return fail(
        "duration",
        "recurrence durations longer than one day are not supported",
      );
    }
    if (hours === 24) {
      if (
        (byHour ?? [time?.hour ?? 0]).some((hour) => hour !== 0) ||
        (byMinute ?? [time?.minute ?? 0]).some((minute) => minute !== 0)
      ) {
        return fail("duration", "a full-day recurrence must start at midnight");
      }
      return always();
    }
    return any(
      ...(byHour ?? [time?.hour ?? 0]).flatMap((hour) =>
        (byMinute ?? [time?.minute ?? 0]).map((minute) => {
          const start = Temporal.PlainTime.from({ hour, minute });
          return timeOfDayRange(start.toString(), start.add(amount).toString());
        }),
      ),
    );
  }

  return timeOfDayRule(
    coveredMinutes(
      byHour ?? [time?.hour ?? 0],
      byMinute ?? [time?.minute ?? 0],
    ),
  );
}
