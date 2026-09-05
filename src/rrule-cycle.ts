/**
 * How often a recurrence comes round, and where it starts counting.
 *
 * RFC 5545 counts weeks from WKST, which is Monday when nothing says
 * otherwise. Quando's `every` counts them from its anchor, so anchoring to the
 * WKST day on or before the start is what makes the two agree about which
 * days share a week. That only shows up when an interval of more than one week
 * meets a BYDAY naming several days, and it is wrong in a way nothing else
 * would catch.
 */

import { always } from "./build.js";
import { every } from "./every-builders.js";
import { fail } from "./parse-shape.js";
import { type Period, type Rule, WEEKDAYS, type Weekday } from "./rule.js";

const WHOLE_NUMBER = /^\d+$/u;

export function cycleRule(
  parts: Map<string, string>,
  period: Period,
  start: Temporal.PlainDate,
  zone: string | undefined,
): Rule {
  // Read before the early return below. An interval of one does not need the
  // answer, and a WKST that is not a weekday is still wrong.
  const weekStart = weekStartOf(parts);
  const interval = intervalOf(parts);

  if (interval === 1) {
    // Every period, which narrows nothing. Left out of the rule document
    // rather than written as a cycle that always holds.
    return always();
  }

  const anchor = period === "weeks" ? weekAnchor(start, weekStart) : start;
  // The zone stays absent when the caller gave none, so the cycle turns over
  // on the same midnight as every other rule in the recurrence. Pinning it to
  // one zone while the rest follow the query's put the two an hour apart
  // across a daylight-saving change, and covered the first hour of a day the
  // cycle had already left.
  return zone === undefined
    ? every(interval, period, { anchor: anchor.toString() })
    : every(interval, period, { anchor: anchor.toString(), zone });
}

function intervalOf(parts: Map<string, string>): number {
  const written = parts.get("INTERVAL");
  if (written === undefined) {
    return 1;
  }
  if (!WHOLE_NUMBER.test(written) || Number(written) < 1) {
    return fail("INTERVAL", `"${written}" is not a whole number of 1 or more`);
  }
  return Number(written);
}

function weekStartOf(parts: Map<string, string>): Weekday {
  const written = parts.get("WKST");
  if (written === undefined) {
    return "monday";
  }
  const day = WEEKDAYS.find(
    (name) => name.slice(0, 2).toUpperCase() === written.toUpperCase(),
  );
  return day ?? fail("WKST", `"${written}" is not a weekday`);
}

/** The WKST day on or before a date. */
function weekAnchor(
  start: Temporal.PlainDate,
  weekStart: Weekday,
): Temporal.PlainDate {
  const wanted = WEEKDAYS.indexOf(weekStart) + 1;
  return start.subtract({ days: (start.dayOfWeek - wanted + 7) % 7 });
}
