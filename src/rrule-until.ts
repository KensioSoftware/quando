/**
 * The day an `UNTIL` bounds a recurrence at.
 *
 * Quando bounds by whole days, so the job is to work out which day the value
 * names. RFC 5545 writes it three ways and two of them are already that day:
 * a bare date is one, and a timestamp without a `Z` is local time, so the day
 * it names is the one written.
 *
 * A timestamp ending in `Z` is an instant, and which day it lands on depends
 * on where the recurrence is read. That one is converted. The named day is
 * included either way, which is what `UNTIL` means.
 */

import { fail } from "./parse-shape.js";

/**
 * The date an `UNTIL` names.
 *
 * RFC 5545 writes it as a UTC timestamp or a bare date. Quando bounds by whole
 * days, so the time is read and then dropped, and the named day is included.
 */
export function parseUntil(value: string, zone: string): string {
  const match = /^(?<date>\d{8})(T(?<time>\d{6})(?<utc>Z)?)?$/u.exec(
    value.trim(),
  );
  const date = match?.groups?.["date"];
  if (date === undefined) {
    return fail(
      "UNTIL",
      `"${value}" is not a date. Expected something like 20261231T235959Z`,
    );
  }

  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const time = match?.groups?.["time"];
  if (time === undefined || match?.groups?.["utc"] === undefined) {
    return checkedDate(iso, value);
  }

  // A timestamp is UTC, and which day it lands on depends on where it is read.
  const clock = `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`;
  try {
    return Temporal.ZonedDateTime.from(`${iso}T${clock}[UTC]`)
      .withTimeZone(zone)
      .toPlainDate()
      .toString();
  } catch {
    return fail("UNTIL", `"${value}" is not a date and time`);
  }
}

function checkedDate(iso: string, written: string): string {
  try {
    Temporal.PlainDate.from(iso);
  } catch {
    return fail("UNTIL", `"${written}" is not a date`);
  }
  return iso;
}
