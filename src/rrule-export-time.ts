/**
 * The time of day a recurrence starts at, and how long each occurrence runs.
 *
 * A recurrence fires at an instant and carries its length somewhere else — in
 * DTEND or DURATION beside it, never in the RRULE. So a rule covering 09:00 to
 * 17:00 comes back as a start of 09:00 and a duration of eight hours, and the
 * two together are what a calendar entry needs.
 *
 * `BYHOUR` and `BYMINUTE` select every combination of what they name, the way
 * cron's two clock fields do, so several windows in a day have to start at
 * such a product and all run for the same length.
 */

import { type Unwritable, unwritable } from "./export-result.js";
import { clockOf, factorsOf, type Window } from "./day-windows.js";

/** DTSTART's clock time, the parts that repeat it, and one occurrence's length. */
export interface ClockParts {
  readonly ok: true;
  /** Nothing at all when the recurrence covers whole days. */
  readonly time: string | undefined;
  /** Written as BYHOUR only when the recurrence runs at more than one. */
  readonly hours: readonly number[] | undefined;
  readonly minutes: readonly number[] | undefined;
  /** How long one occurrence lasts, as an ISO 8601 duration. */
  readonly duration: string;
}

export function clockPartsOf(
  windows: readonly Window[] | undefined,
): ClockParts | Unwritable {
  if (windows === undefined) {
    return {
      ok: true,
      time: undefined,
      hours: undefined,
      minutes: undefined,
      duration: "P1D",
    };
  }

  if (new Set(windows.map((window) => window.length)).size !== 1) {
    return unwritable(
      "its occurrences are not all the same length, and a recurrence carries one duration",
    );
  }

  const parts = factorsOf(windows.map((window) => window.start));
  if (parts === undefined) {
    return unwritable(
      "the times of day it starts at are not a set of hours crossed with a set of minutes, which is all BYHOUR and BYMINUTE can select",
    );
  }

  return {
    ok: true,
    time: clockOf(Math.min(...windows.map((window) => window.start))),
    // Left out when there is only one, because a recurrence that names none
    // takes the hour and the minute from DTSTART, which already has them.
    hours: parts.hours.length > 1 ? parts.hours : undefined,
    minutes: parts.minutes.length > 1 ? parts.minutes : undefined,
    duration: durationOf(Math.max(...windows.map((window) => window.length))),
  };
}

/** Minutes as the duration a calendar entry carries: 480 is `PT8H`. */
function durationOf(minutes: number): string {
  return Temporal.Duration.from({ minutes })
    .round({ largestUnit: "hour" })
    .toString();
}
